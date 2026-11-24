import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import type {
  AnimalDetail,
  CreateAnimalRequest,
  ErrorResponse,
  ListAnimalsResponse,
} from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';
import { MVP_SHELTER_ID } from '../../domain/value-objects/mvp-shelter';

const ACCESS_SECRET = 'test-access-secret-0123456789abcdef-test';
const REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef-test';

const validBody: CreateAnimalRequest = {
  name: 'Luna',
  species: 'DOG',
  size: 'MEDIUM',
  ageGroup: 'ADULT',
  photoUrls: ['https://images.example.com/luna.jpg'],
  temperament: ['CALM'],
  compatibleWithChildren: true,
};

function tokenFor(role: 'USER' | 'ADMIN'): Promise<string> {
  return new JwtService().signAsync(
    {
      sub: '00000000-0000-4000-8000-00000000000a',
      sid: '00000000-0000-4000-8000-00000000000b',
      role,
    },
    { secret: ACCESS_SECRET, algorithm: 'HS256', expiresIn: 900 },
  );
}

describe('Animals HTTP API (PostgreSQL)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let adminToken: string;
  let userToken: string;

  function create(body: unknown, token?: string) {
    const call = request(app.getHttpServer())
      .post('/api/v1/animals')
      .send(body as object);
    return token ? call.set('Authorization', `Bearer ${token}`) : call;
  }

  async function insert(
    name: string,
    fields: Partial<CreateAnimalRequest> & { status?: 'AVAILABLE' | 'RESERVED' | 'ADOPTED' } = {},
  ): Promise<string> {
    const { status, ...rest } = fields;
    const response = await create({ ...validBody, name, ...rest }, adminToken).expect(201);
    const id = (response.body as AnimalDetail).id;
    if (status) await db.prisma.animal.update({ where: { id }, data: { status } });
    return id;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN: 'http://localhost:5173',
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
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
    adminToken = await tokenFor('ADMIN');
    userToken = await tokenFor('USER');
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  describe('POST /api/v1/animals (SCRUM-10)', () => {
    it('lets an ADMIN register an AVAILABLE animal in the MVP shelter (scenario 1)', async () => {
      const response = await create(validBody, adminToken).expect(201);

      const body = response.body as AnimalDetail;
      expect(body).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        name: 'Luna',
        species: 'DOG',
        size: 'MEDIUM',
        ageGroup: 'ADULT',
        breed: null,
        temperament: ['CALM'],
        compatibleWithChildren: true,
        compatibleWithOtherAnimals: null,
        careNotes: null,
        photoUrls: ['https://images.example.com/luna.jpg'],
        status: 'AVAILABLE',
        createdAt: expect.any(String),
      });
      const row = await db.prisma.animal.findUnique({ where: { id: body.id } });
      expect(row?.shelterId).toBe(MVP_SHELTER_ID);
    });

    it('responds 401 without an access token', async () => {
      await create(validBody).expect(401);
      expect(await db.prisma.animal.count()).toBe(0);
    });

    it('responds 403 to an authenticated USER and creates nothing (only ADMIN, ADR-003)', async () => {
      const response = await create(validBody, userToken).expect(403);

      expect(response.body).toEqual({
        statusCode: 403,
        error: 'Forbidden',
        message: 'Request could not be processed',
      });
      expect(await db.prisma.animal.count()).toBe(0);
    });

    it('responds 400 with one detail per missing field (scenarios 2 and 3)', async () => {
      const response = await create({}, adminToken).expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toMatchObject({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Validation failed',
      });
      expect(body.details?.map(({ field, code }) => ({ field, code }))).toEqual([
        { field: 'name', code: 'REQUIRED' },
        { field: 'species', code: 'REQUIRED' },
        { field: 'size', code: 'REQUIRED' },
        { field: 'ageGroup', code: 'REQUIRED' },
        { field: 'photoUrls', code: 'REQUIRED' },
      ]);
      expect(body.details?.every((detail) => typeof detail.message === 'string')).toBe(true);
      expect(await db.prisma.animal.count()).toBe(0);
    });

    it('responds 400 INVALID_FORMAT for values outside the taxonomy (scenario 4)', async () => {
      const response = await create(
        { ...validBody, species: 'BIRD', size: 'XL', ageGroup: 'BABY', temperament: ['GRUMPY'] },
        adminToken,
      ).expect(400);

      expect(
        (response.body as ErrorResponse).details?.map(({ field, code }) => ({ field, code })),
      ).toEqual([
        { field: 'species', code: 'INVALID_FORMAT' },
        { field: 'size', code: 'INVALID_FORMAT' },
        { field: 'ageGroup', code: 'INVALID_FORMAT' },
        { field: 'temperament', code: 'INVALID_FORMAT' },
      ]);
    });

    it('responds 400 INVALID_TYPE for a field of the wrong type', async () => {
      const response = await create(
        { ...validBody, photoUrls: 'https://x.example.com/a.jpg' },
        adminToken,
      ).expect(400);

      expect((response.body as ErrorResponse).details).toEqual([
        { field: 'photoUrls', code: 'INVALID_TYPE', message: expect.any(String) },
      ]);
    });
  });

  describe('GET /api/v1/animals (SCRUM-12)', () => {
    function list(query = '') {
      return request(app.getHttpServer()).get(`/api/v1/animals${query}`).expect(200);
    }

    async function namesOf(query: string): Promise<string[]> {
      const response = await list(query);
      return (response.body as ListAnimalsResponse).items.map((item) => item.name).sort();
    }

    it('is public and lists only AVAILABLE animals as cards (scenarios 1 and 4)', async () => {
      await insert('Available');
      await insert('Reserved', { status: 'RESERVED' });
      await insert('Adopted', { status: 'ADOPTED' });

      const response = await list();

      expect(response.body).toEqual({
        items: [
          {
            id: expect.any(String),
            name: 'Available',
            species: 'DOG',
            size: 'MEDIUM',
            ageGroup: 'ADULT',
            temperament: ['CALM'],
            compatibleWithChildren: true,
            compatibleWithOtherAnimals: null,
            photoUrl: 'https://images.example.com/luna.jpg',
          },
        ],
        page: 1,
        pageSize: 12,
        total: 1,
      });
    });

    describe('filters (scenario 2)', () => {
      beforeEach(async () => {
        await insert('Dog', {
          species: 'DOG',
          size: 'LARGE',
          ageGroup: 'SENIOR',
          compatibleWithChildren: true,
          compatibleWithOtherAnimals: false,
        });
        await insert('Cat', {
          species: 'CAT',
          size: 'SMALL',
          ageGroup: 'YOUNG',
          compatibleWithChildren: false,
          compatibleWithOtherAnimals: true,
        });
      });

      it('filters by species', async () => {
        expect(await namesOf('?species=CAT')).toEqual(['Cat']);
      });

      it('filters by size', async () => {
        expect(await namesOf('?size=LARGE')).toEqual(['Dog']);
      });

      it('filters by ageGroup', async () => {
        expect(await namesOf('?ageGroup=YOUNG')).toEqual(['Cat']);
      });

      it('filters by compatibleWithChildren', async () => {
        expect(await namesOf('?compatibleWithChildren=true')).toEqual(['Dog']);
      });

      it('filters by compatibleWithOtherAnimals', async () => {
        expect(await namesOf('?compatibleWithOtherAnimals=true')).toEqual(['Cat']);
      });

      it('combines filters and returns an empty list when nothing matches (scenario 3)', async () => {
        expect(await namesOf('?species=DOG&compatibleWithOtherAnimals=true')).toEqual([]);
      });
    });

    it('paginates with page and pageSize', async () => {
      await insert('A');
      await insert('B');
      await insert('C');

      const body = (await list('?page=2&pageSize=2')).body as ListAnimalsResponse;

      expect(body).toMatchObject({ page: 2, pageSize: 2, total: 3 });
      expect(body.items.map((item) => item.name)).toEqual(['A']);
    });

    it('responds 400 for a filter value outside the taxonomy or a bad page', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/animals?species=BIRD&compatibleWithChildren=yes&pageSize=500')
        .expect(400);

      expect(
        (response.body as ErrorResponse).details?.map(({ field, code }) => ({ field, code })),
      ).toEqual([
        { field: 'species', code: 'INVALID_FORMAT' },
        { field: 'compatibleWithChildren', code: 'INVALID_FORMAT' },
        { field: 'pageSize', code: 'INVALID_FORMAT' },
      ]);
    });
  });

  describe('GET /api/v1/animals/:id (SCRUM-13)', () => {
    it('is public and returns the full detail, also of a RESERVED animal (scenarios 1 and 2)', async () => {
      const id = await insert('Luna', { careNotes: 'Needs a garden', status: 'RESERVED' });

      const response = await request(app.getHttpServer()).get(`/api/v1/animals/${id}`).expect(200);

      expect(response.body).toMatchObject({
        id,
        name: 'Luna',
        careNotes: 'Needs a garden',
        status: 'RESERVED',
      });
    });

    it('responds 404 for an unknown id and for a malformed one (scenario 3)', async () => {
      for (const id of ['00000000-0000-4000-8000-0000000000ff', 'not-a-uuid']) {
        const response = await request(app.getHttpServer())
          .get(`/api/v1/animals/${id}`)
          .expect(404);
        expect(response.body).toEqual({
          statusCode: 404,
          error: 'Not Found',
          message: 'Animal not found',
        });
      }
    });
  });
});
