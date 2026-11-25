import { AdoptionRequest } from '../../domain/entities/adoption-request.entity';
import {
  AdoptionAnimalNotFoundError,
  AdoptionRequestActiveError,
  AdoptionRequestNotFoundError,
  AnimalNotAvailableError,
  TransitionNotAllowedError,
} from '../../domain/errors/adoption-errors';
import type { AdoptionStatus, AnimalStatus } from '../../domain/value-objects/adoption-states';
import { InMemoryAdoptionRepository } from '../../testing/in-memory-adoption-repository';
import { DecideAdoptionRequestUseCase } from './decide-adoption-request.use-case';
import { ListAdoptionRequestsUseCase } from './list-adoption-requests.use-case';
import { SubmitAdoptionRequestUseCase } from './submit-adoption-request.use-case';

const ANIMAL = '00000000-0000-4000-8000-0000000000a1';
const USER = '00000000-0000-4000-8000-0000000000b1';
const ADMIN = '00000000-0000-4000-8000-0000000000c1';
const NOW = new Date('2026-11-25T10:00:00.000Z');

let sequence = 0;
const ids = { next: () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}` };
const clock = { now: () => NOW };

function setup(animalStatus: AnimalStatus = 'AVAILABLE') {
  const repository = new InMemoryAdoptionRepository();
  repository.animals.set(ANIMAL, { name: 'Luna', status: animalStatus });
  return {
    repository,
    submit: new SubmitAdoptionRequestUseCase(repository, clock, ids),
    decide: new DecideAdoptionRequestUseCase(repository, clock),
    list: new ListAdoptionRequestsUseCase(repository),
  };
}

function seed(repository: InMemoryAdoptionRepository, status: AdoptionStatus): string {
  const request = AdoptionRequest.reconstitute({
    ...AdoptionRequest.submit({ id: ids.next(), animalId: ANIMAL, applicantUserId: USER, now: NOW })
      .props,
    status,
  });
  repository.requests.set(request.id, request);
  return request.id;
}

describe('SubmitAdoptionRequestUseCase (SCRUM-14)', () => {
  it('creates a PENDING request for an AVAILABLE animal (scenario 1)', async () => {
    const { submit, repository } = setup();

    const view = await submit.execute({ animalId: ANIMAL, applicantUserId: USER, message: 'Hola' });

    expect(view).toMatchObject({ status: 'PENDING', message: 'Hola', animal: { id: ANIMAL } });
    expect(repository.requests.size).toBe(1);
  });

  it.each(['RESERVED', 'ADOPTED'] as const)(
    'rejects an animal that is %s (scenario 3)',
    async (status) => {
      const { submit } = setup(status);
      await expect(
        submit.execute({ animalId: ANIMAL, applicantUserId: USER }),
      ).rejects.toBeInstanceOf(AnimalNotAvailableError);
    },
  );

  it('rejects an unknown animal', async () => {
    const { submit } = setup();
    await expect(
      submit.execute({ animalId: '00000000-0000-4000-8000-0000000000ff', applicantUserId: USER }),
    ).rejects.toBeInstanceOf(AdoptionAnimalNotFoundError);
  });

  it('rejects a second request while one is active (scenario 4)', async () => {
    const { submit, repository } = setup();
    seed(repository, 'PENDING');

    await expect(
      submit.execute({ animalId: ANIMAL, applicantUserId: USER }),
    ).rejects.toBeInstanceOf(AdoptionRequestActiveError);
  });

  it.each(['REJECTED', 'CANCELLED'] as const)(
    'allows a new request after a %s one (scenario 5)',
    async (status) => {
      const { submit, repository } = setup();
      seed(repository, status);

      await submit.execute({ animalId: ANIMAL, applicantUserId: USER });

      expect(repository.requests.size).toBe(2);
    },
  );
});

describe('DecideAdoptionRequestUseCase (SCRUM-15)', () => {
  it.each([
    ['approve', 'PENDING', 'AVAILABLE', 'APPROVED', 'RESERVED'],
    ['reject', 'PENDING', 'AVAILABLE', 'REJECTED', 'AVAILABLE'],
    ['complete', 'APPROVED', 'RESERVED', 'COMPLETED', 'ADOPTED'],
    ['cancel', 'APPROVED', 'RESERVED', 'CANCELLED', 'AVAILABLE'],
  ] as const)(
    '%s: %s → %s and the animal ends %s, recording the admin and the time',
    async (action, from, animalFrom, to, animalTo) => {
      const { decide, repository } = setup(animalFrom);
      const id = seed(repository, from);

      const view = await decide.execute({ requestId: id, action, adminUserId: ADMIN });

      expect(view).toMatchObject({ status: to, decidedAt: NOW, animal: { status: animalTo } });
      expect(repository.requests.get(id)).toMatchObject({ decidedByUserId: ADMIN, decidedAt: NOW });
    },
  );

  it('rejects an action not allowed from the current status (scenario 6)', async () => {
    const { decide, repository } = setup();
    const id = seed(repository, 'PENDING');

    await expect(
      decide.execute({ requestId: id, action: 'complete', adminUserId: ADMIN }),
    ).rejects.toBeInstanceOf(TransitionNotAllowedError);
    expect(repository.requests.get(id)?.status).toBe('PENDING');
  });

  it('rejects approving when the animal is no longer AVAILABLE, changing nothing', async () => {
    const { decide, repository } = setup('RESERVED');
    const id = seed(repository, 'PENDING');

    await expect(
      decide.execute({ requestId: id, action: 'approve', adminUserId: ADMIN }),
    ).rejects.toBeInstanceOf(AnimalNotAvailableError);
    expect(repository.requests.get(id)?.status).toBe('PENDING');
  });

  it('rejects an unknown request', async () => {
    const { decide } = setup();
    await expect(
      decide.execute({
        requestId: '00000000-0000-4000-8000-0000000000ff',
        action: 'approve',
        adminUserId: ADMIN,
      }),
    ).rejects.toBeInstanceOf(AdoptionRequestNotFoundError);
  });
});

describe('ListAdoptionRequestsUseCase (SCRUM-15, scenario 5)', () => {
  it('turns page and pageSize into an offset', async () => {
    const { list, repository } = setup();
    seed(repository, 'PENDING');
    seed(repository, 'REJECTED');

    const result = await list.execute({ filters: { animalId: ANIMAL }, page: 2, pageSize: 1 });

    expect(result).toMatchObject({ total: 2, page: 2, pageSize: 1 });
    expect(result.items).toHaveLength(1);
  });
});
