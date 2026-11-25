import { randomUUID } from 'node:crypto';

import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { AdoptionRequest, decisionFor } from '../../../domain/entities/adoption-request.entity';
import { AdoptionRequestActiveError } from '../../../domain/errors/adoption-errors';
import type { AdoptionStatus } from '../../../domain/value-objects/adoption-states';
import { seedAnimal, seedUser } from '../../../testing/seed-rows';
import { PrismaAdoptionRequestRepository } from './prisma-adoption-request.repository';

const NOW = new Date('2026-11-25T10:00:00.000Z');

describe('PrismaAdoptionRequestRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let repository: PrismaAdoptionRequestRepository;
  let applicant: { id: string; email: string };
  let admin: { id: string };
  let animalId: string;

  function newRequest(createdAt = NOW): AdoptionRequest {
    return AdoptionRequest.submit({
      id: randomUUID(),
      animalId,
      applicantUserId: applicant.id,
      message: 'Hola',
      now: createdAt,
    });
  }

  async function stored(status: AdoptionStatus): Promise<string> {
    const request = newRequest();
    await repository.create(request);
    await db.prisma.adoptionRequest.update({ where: { id: request.id }, data: { status } });
    return request.id;
  }

  const animalStatus = async () =>
    (await db.prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).status;
  const requestRow = (id: string) => db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id } });

  beforeAll(async () => {
    db = await startTestDatabase();
    repository = new PrismaAdoptionRequestRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
    applicant = await seedUser(db.prisma, { firstName: 'Ana' });
    admin = await seedUser(db.prisma, { role: 'ADMIN' });
    animalId = await seedAnimal(db.prisma);
  });

  afterAll(async () => {
    await db.stop();
  });

  it('reads the animal status, or null for an unknown animal', async () => {
    expect(await repository.animalStatus(animalId)).toBe('AVAILABLE');
    expect(await repository.animalStatus(randomUUID())).toBeNull();
  });

  it('creates a request and returns its view with the animal and the applicant', async () => {
    const request = newRequest();
    await repository.create(request);

    expect(await repository.findView(request.id)).toEqual({
      id: request.id,
      status: 'PENDING',
      message: 'Hola',
      createdAt: NOW,
      decidedAt: null,
      animal: { id: animalId, name: 'Luna', status: 'AVAILABLE' },
      applicant: { firstName: 'Ana', lastName: 'Ruiz', email: applicant.email },
    });
    expect(await repository.findById(request.id)).toEqual(request);
  });

  describe('partial unique index (SCRUM-14, scenarios 4 and 5)', () => {
    it.each(['PENDING', 'APPROVED'] as const)(
      'rejects a second request while one is %s',
      async (status) => {
        await stored(status);
        await expect(repository.create(newRequest())).rejects.toBeInstanceOf(
          AdoptionRequestActiveError,
        );
      },
    );

    it.each(['REJECTED', 'CANCELLED', 'COMPLETED'] as const)(
      'allows a new request after a %s one',
      async (status) => {
        await stored(status);
        await expect(repository.create(newRequest())).resolves.toBeUndefined();
      },
    );

    it('lets only one of two simultaneous requests through', async () => {
      const results = await Promise.allSettled([
        repository.create(newRequest()),
        repository.create(newRequest()),
      ]);

      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(await db.prisma.adoptionRequest.count()).toBe(1);
    });

    it('does not block another user on the same animal', async () => {
      await stored('PENDING');
      const other = await seedUser(db.prisma);
      const request = AdoptionRequest.submit({
        id: randomUUID(),
        animalId,
        applicantUserId: other.id,
        now: NOW,
      });
      await expect(repository.create(request)).resolves.toBeUndefined();
    });
  });

  describe('applyDecision (SCRUM-15): request and animal in one transaction', () => {
    const by = () => ({ userId: admin.id, at: NOW });

    it.each([
      ['approve', 'PENDING', 'AVAILABLE', 'APPROVED', 'RESERVED'],
      ['reject', 'PENDING', 'AVAILABLE', 'REJECTED', 'AVAILABLE'],
      ['complete', 'APPROVED', 'RESERVED', 'COMPLETED', 'ADOPTED'],
      ['cancel', 'APPROVED', 'RESERVED', 'CANCELLED', 'AVAILABLE'],
    ] as const)('%s changes both rows', async (action, from, animalFrom, to, animalTo) => {
      await db.prisma.animal.update({ where: { id: animalId }, data: { status: animalFrom } });
      const id = await stored(from);

      expect(await repository.applyDecision(id, decisionFor(action, from)!, by())).toBe('applied');

      expect(await requestRow(id)).toMatchObject({
        status: to,
        decidedByUserId: admin.id,
        decidedAt: NOW,
      });
      expect(await animalStatus()).toBe(animalTo);
    });

    it('changes nothing when the animal is no longer AVAILABLE (approve)', async () => {
      const id = await stored('PENDING');
      await db.prisma.animal.update({ where: { id: animalId }, data: { status: 'RESERVED' } });

      expect(await repository.applyDecision(id, decisionFor('approve', 'PENDING')!, by())).toBe(
        'animal-changed',
      );
      expect((await requestRow(id)).status).toBe('PENDING');
      expect(await animalStatus()).toBe('RESERVED');
    });

    it('changes nothing when the request already moved (another admin)', async () => {
      const id = await stored('REJECTED');

      expect(await repository.applyDecision(id, decisionFor('approve', 'PENDING')!, by())).toBe(
        'request-changed',
      );
      expect(await animalStatus()).toBe('AVAILABLE');
    });

    it('approves only one of two PENDING requests of the same animal racing', async () => {
      const first = await stored('PENDING');
      const other = await seedUser(db.prisma);
      const second = AdoptionRequest.submit({
        id: randomUUID(),
        animalId,
        applicantUserId: other.id,
        now: NOW,
      });
      await repository.create(second);
      const approve = decisionFor('approve', 'PENDING')!;

      const outcomes = await Promise.all([
        repository.applyDecision(first, approve, by()),
        repository.applyDecision(second.id, approve, by()),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'applied')).toHaveLength(1);
      expect(await db.prisma.adoptionRequest.count({ where: { status: 'APPROVED' } })).toBe(1);
      expect(await animalStatus()).toBe('RESERVED');
    });
  });

  describe('list (scenario 5)', () => {
    it('filters by status and animal, newest first, with the total', async () => {
      const otherAnimal = await seedAnimal(db.prisma, 'AVAILABLE', 'Toby');
      await repository.create(newRequest(new Date(NOW.getTime() - 1000)));
      const other = await seedUser(db.prisma);
      const newest = AdoptionRequest.submit({
        id: randomUUID(),
        animalId,
        applicantUserId: other.id,
        now: NOW,
      });
      await repository.create(newest);
      await repository.create(
        AdoptionRequest.submit({
          id: randomUUID(),
          animalId: otherAnimal,
          applicantUserId: applicant.id,
          now: NOW,
        }),
      );
      await db.prisma.adoptionRequest.update({
        where: { id: newest.id },
        data: { status: 'REJECTED' },
      });

      const byAnimal = await repository.list({ animalId }, { offset: 0, limit: 10 });
      expect(byAnimal.total).toBe(2);
      expect(byAnimal.items[0]!.id).toBe(newest.id);

      const rejected = await repository.list({ status: 'REJECTED' }, { offset: 0, limit: 10 });
      expect(rejected.items.map((item) => item.id)).toEqual([newest.id]);

      const page = await repository.list({}, { offset: 1, limit: 1 });
      expect(page).toMatchObject({ total: 3 });
      expect(page.items).toHaveLength(1);
    });
  });
});
