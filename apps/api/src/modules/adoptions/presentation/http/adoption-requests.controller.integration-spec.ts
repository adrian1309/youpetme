import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import type {
  AdoptionRequestItem,
  ErrorResponse,
  ListAdoptionRequestsResponse,
} from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';
import { seedAnimal, seedUser } from '../../testing/seed-rows';

const ACCESS_SECRET = 'test-access-secret-0123456789abcdef-test';
const PATH = '/api/v1/adoption-requests';

describe('Adoption requests HTTP API (PostgreSQL)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let user: { id: string; email: string };
  let admin: { id: string };
  let userToken: string;
  let adminToken: string;
  let animalId: string;

  const tokenFor = (sub: string, role: 'USER' | 'ADMIN') =>
    new JwtService().signAsync(
      { sub, sid: '00000000-0000-4000-8000-00000000000b', role },
      { secret: ACCESS_SECRET, algorithm: 'HS256', expiresIn: 900 },
    );

  const http = () => request(app.getHttpServer());
  const submit = (body: object, token = userToken) =>
    http().post(PATH).set('Authorization', `Bearer ${token}`).send(body);
  const act = (id: string, action: string, token = adminToken) =>
    http().post(`${PATH}/${id}/${action}`).set('Authorization', `Bearer ${token}`);
  const animalStatus = async () =>
    (await db.prisma.animal.findUniqueOrThrow({ where: { id: animalId } })).status;

  async function pendingRequest(): Promise<string> {
    const response = await submit({ animalId }).expect(201);
    return (response.body as AdoptionRequestItem).id;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN: 'http://localhost:5173',
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef-test',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION: '2026-01',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { webOrigin: 'http://localhost:5173' });
    await app.init();
  });

  beforeEach(async () => {
    await db.reset();
    user = await seedUser(db.prisma, { firstName: 'Ana' });
    admin = await seedUser(db.prisma, { role: 'ADMIN' });
    userToken = await tokenFor(user.id, 'USER');
    adminToken = await tokenFor(admin.id, 'ADMIN');
    animalId = await seedAnimal(db.prisma);
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  describe('POST /adoption-requests (SCRUM-14)', () => {
    it('creates a PENDING request for the authenticated user (scenario 1)', async () => {
      const response = await submit({ animalId, message: ' Tengo jardín ' }).expect(201);

      expect(response.body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        status: 'PENDING',
        message: 'Tengo jardín',
        createdAt: expect.any(String),
        decidedAt: null,
        animal: { id: animalId, name: 'Luna', status: 'AVAILABLE' },
        applicant: { firstName: 'Ana', lastName: 'Ruiz', email: user.email },
      });
      const row = await db.prisma.adoptionRequest.findFirstOrThrow();
      expect(row.applicantUserId).toBe(user.id);
    });

    it('requires authentication (scenario 2)', async () => {
      await http().post(PATH).send({ animalId }).expect(401);
    });

    it('lets an ADMIN request too (any authenticated role)', async () => {
      await submit({ animalId }, adminToken).expect(201);
    });

    it.each(['RESERVED', 'ADOPTED'] as const)(
      'rejects an animal that is %s with 409 ANIMAL_NOT_AVAILABLE (scenario 3)',
      async (status) => {
        await db.prisma.animal.update({ where: { id: animalId }, data: { status } });

        const response = await submit({ animalId }).expect(409);

        expect(response.body).toEqual({
          statusCode: 409,
          error: 'Conflict',
          message: 'This animal is not available for adoption',
          code: 'ANIMAL_NOT_AVAILABLE',
        });
      },
    );

    it('rejects a duplicate with 409 ADOPTION_REQUEST_ACTIVE (scenario 4)', async () => {
      await submit({ animalId }).expect(201);

      const response = await submit({ animalId }).expect(409);

      expect((response.body as ErrorResponse).code).toBe('ADOPTION_REQUEST_ACTIVE');
      expect(await db.prisma.adoptionRequest.count()).toBe(1);
    });

    it('accepts a new request after a REJECTED one (scenario 5)', async () => {
      await act(await pendingRequest(), 'reject').expect(200);

      await submit({ animalId }).expect(201);
    });

    it('responds 404 for an unknown animal', async () => {
      const response = await submit({ animalId: '00000000-0000-4000-8000-0000000000ff' }).expect(
        404,
      );
      expect(response.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Animal not found',
      });
    });

    it('responds 400 with details for invalid input', async () => {
      const missing = await submit({}).expect(400);
      expect(
        (missing.body as ErrorResponse).details?.map(({ field, code }) => ({ field, code })),
      ).toEqual([{ field: 'animalId', code: 'REQUIRED' }]);

      const invalid = await submit({ animalId: 'nope', message: 'a'.repeat(1001) }).expect(400);
      expect(
        (invalid.body as ErrorResponse).details?.map(({ field, code }) => ({ field, code })),
      ).toEqual([
        { field: 'animalId', code: 'INVALID_FORMAT' },
        { field: 'message', code: 'TOO_LONG' },
      ]);

      const wrongType = await submit({ animalId, message: 42 }).expect(400);
      expect((wrongType.body as ErrorResponse).details?.[0]).toMatchObject({
        field: 'message',
        code: 'INVALID_TYPE',
      });
    });
  });

  describe('POST /adoption-requests/:id/:action (SCRUM-15)', () => {
    it('approve: APPROVED, the animal RESERVED, with who decided and when (scenario 1)', async () => {
      const id = await pendingRequest();

      const response = await act(id, 'approve').expect(200);

      expect(response.body).toMatchObject({
        id,
        status: 'APPROVED',
        decidedAt: expect.any(String),
        animal: { status: 'RESERVED' },
      });
      expect(await db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id } })).toMatchObject({
        decidedByUserId: admin.id,
      });
    });

    it('reject: REJECTED, the animal stays AVAILABLE (scenario 2)', async () => {
      const id = await pendingRequest();

      await act(id, 'reject').expect(200);

      expect(await animalStatus()).toBe('AVAILABLE');
    });

    it('complete: COMPLETED, the animal ADOPTED (scenario 3)', async () => {
      const id = await pendingRequest();
      await act(id, 'approve').expect(200);

      const response = await act(id, 'complete').expect(200);

      expect(response.body).toMatchObject({ status: 'COMPLETED', animal: { status: 'ADOPTED' } });
    });

    it('cancel: CANCELLED, the animal back to AVAILABLE (scenario 4)', async () => {
      const id = await pendingRequest();
      await act(id, 'approve').expect(200);

      const response = await act(id, 'cancel').expect(200);

      expect(response.body).toMatchObject({ status: 'CANCELLED', animal: { status: 'AVAILABLE' } });
    });

    it.each([
      ['complete', []],
      ['cancel', []],
      ['approve', ['reject']],
      ['reject', ['approve', 'complete']],
    ])(
      'rejects %s when not allowed with a 409 without code (scenario 6)',
      async (action, before) => {
        const id = await pendingRequest();
        for (const step of before) await act(id, step).expect(200);
        const statusBefore = (await db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id } }))
          .status;

        const response = await act(id, action).expect(409);

        expect(response.body).toEqual({
          statusCode: 409,
          error: 'Conflict',
          message: 'This action is not allowed for the request in its current status',
        });
        expect((await db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
          statusBefore,
        );
      },
    );

    it('rejects approving when the animal is already RESERVED by another request', async () => {
      const first = await pendingRequest();
      const other = await seedUser(db.prisma);
      const second = (await submit({ animalId }, await tokenFor(other.id, 'USER')).expect(201))
        .body as AdoptionRequestItem;
      await act(first, 'approve').expect(200);

      const response = await act(second.id, 'approve').expect(409);

      expect((response.body as ErrorResponse).code).toBe('ANIMAL_NOT_AVAILABLE');
      expect(
        (await db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id: second.id } })).status,
      ).toBe('PENDING');
    });

    it('responds 401 without a token and 403 to a USER, changing nothing', async () => {
      const id = await pendingRequest();

      await http().post(`${PATH}/${id}/approve`).expect(401);
      await act(id, 'approve', userToken).expect(403);

      expect((await db.prisma.adoptionRequest.findUniqueOrThrow({ where: { id } })).status).toBe(
        'PENDING',
      );
      expect(await animalStatus()).toBe('AVAILABLE');
    });

    it('responds 404 for an unknown or malformed request id, and an unknown action', async () => {
      await act('00000000-0000-4000-8000-0000000000ff', 'approve').expect(404);
      await act('nope', 'approve').expect(404);
      await act(await pendingRequest(), 'archive').expect(404);
    });
  });

  describe('GET /adoption-requests (SCRUM-15, scenario 5)', () => {
    const list = (query = '', token = adminToken) =>
      http().get(`${PATH}${query}`).set('Authorization', `Bearer ${token}`);

    it('lists every request of an animal, with its status, for an ADMIN', async () => {
      const first = await pendingRequest();
      await act(first, 'reject').expect(200);
      const second = await pendingRequest();
      const otherAnimal = await seedAnimal(db.prisma, 'AVAILABLE', 'Toby');
      await submit({ animalId: otherAnimal }).expect(201);

      const body = (await list(`?animalId=${animalId}`).expect(200))
        .body as ListAdoptionRequestsResponse;

      expect(body).toMatchObject({ page: 1, pageSize: 12, total: 2 });
      expect(body.items.map(({ id, status }) => ({ id, status }))).toEqual([
        { id: second, status: 'PENDING' },
        { id: first, status: 'REJECTED' },
      ]);
    });

    it('filters by status and paginates', async () => {
      await act(await pendingRequest(), 'reject').expect(200);
      await pendingRequest();

      const rejected = (await list('?status=REJECTED').expect(200))
        .body as ListAdoptionRequestsResponse;
      expect(rejected.items.map((item) => item.status)).toEqual(['REJECTED']);

      const paged = (await list('?page=2&pageSize=1').expect(200))
        .body as ListAdoptionRequestsResponse;
      expect(paged).toMatchObject({ page: 2, pageSize: 1, total: 2 });
      expect(paged.items).toHaveLength(1);
    });

    it('responds 400 for a status or animalId that is not allowed', async () => {
      const response = await list('?status=LOST&animalId=x&pageSize=500').expect(400);
      expect((response.body as ErrorResponse).details?.map(({ field }) => field)).toEqual([
        'status',
        'animalId',
        'pageSize',
      ]);
    });

    it('responds 401 without a token and 403 to a USER', async () => {
      await http().get(PATH).expect(401);
      await list('', userToken).expect(403);
    });
  });
});
