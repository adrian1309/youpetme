import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { ErrorResponse, RegisterRequest, RegisterResponse } from '@youpetme/contracts';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { buildOpenApiDocument } from '../../../../app/openapi';
import { configureApp } from '../../../../app/configure-app';
import { PrismaService } from '../../../../platform/database/prisma.service';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';
import { ACCOUNT_REGISTRATION_REPOSITORY } from '../../iam.tokens';

const ACCESS_SECRET = 'test-access-secret-0123456789abcdef-test';
const REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef-test';
const WEB_ORIGIN = 'http://localhost:5173';
const PASSWORD = 'my-secure-passphrase';

const validBody: RegisterRequest = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  password: PASSWORD,
  confirmPassword: PASSWORD,
  termsAccepted: true,
};

describe('POST /api/v1/auth/register (PostgreSQL)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let prisma: PrismaService;
  let output: string;
  const stdout = jest.spyOn(process.stdout, 'write');
  const stderr = jest.spyOn(process.stderr, 'write');

  async function createApp(
    override?: (builder: ReturnType<typeof Test.createTestingModule>) => void,
  ): Promise<INestApplication> {
    const builder = Test.createTestingModule({ imports: [AppModule] });
    override?.(builder);
    const moduleRef = await builder.compile();
    const created = moduleRef.createNestApplication();
    configureApp(created, { webOrigin: WEB_ORIGIN });
    await created.init();
    return created;
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN,
      JWT_ACCESS_SECRET: ACCESS_SECRET,
      JWT_REFRESH_SECRET: REFRESH_SECRET,
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION: '2026-01',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
    });
    app = await createApp();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    output = '';
    const capture = (chunk: unknown): boolean => {
      output += String(chunk);
      return true;
    };
    stdout.mockImplementation(capture);
    stderr.mockImplementation(capture);
    await db.reset();
  });

  afterEach(() => {
    stdout.mockReset();
    stderr.mockReset();
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  describe('Given valid data', () => {
    it('responds 201 with the user and an access token, and never the refresh token', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validBody)
        .expect(201);

      const body = response.body as RegisterResponse;
      expect(body.user).toEqual({
        id: expect.stringMatching(/^[0-9a-f-]{36}$/),
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        status: 'ACTIVE',
      });
      expect(Object.keys(body)).toEqual(['user', 'authentication']);
      expect(Object.keys(body.authentication)).toEqual(['accessToken']);
      expect(JSON.stringify(response.body)).not.toMatch(/refresh|hash|password/i);
      expect(response.headers['cache-control']).toBe('no-store');

      const claims = await new JwtService().verifyAsync<{ sub: string; role: string }>(
        body.authentication.accessToken,
        { secret: ACCESS_SECRET },
      );
      expect(claims).toMatchObject({ sub: body.user.id, role: 'USER' });
    });

    it('sets the refresh token only as an HttpOnly, Secure, SameSite=Strict cookie scoped to /api/v1/auth', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validBody)
        .expect(201);

      const cookies = response.headers['set-cookie'] as unknown as string[];
      expect(cookies).toHaveLength(1);
      const cookie = cookies[0]!;
      expect(cookie).toMatch(/^refresh_token=[^;]+;/);
      expect(cookie).toContain('HttpOnly');
      expect(cookie).toContain('Secure');
      expect(cookie).toContain('SameSite=Strict');
      expect(cookie).toContain('Path=/api/v1/auth');

      const token = /^refresh_token=([^;]+);/.exec(cookie)![1]!;
      const claims = await new JwtService().verifyAsync<{ sub: string; sid: string }>(token, {
        secret: REFRESH_SECRET,
      });
      const body = response.body as RegisterResponse;
      expect(claims.sub).toBe(body.user.id);
      const session = await prisma.userSession.findUniqueOrThrow({ where: { id: claims.sid } });
      expect(session.refreshTokenHash).toMatch(/^[0-9a-f]{64}$/);
      expect(session.refreshTokenHash).not.toBe(token);
    });

    it('persists the account with role USER, accepted terms, an Argon2id hash and a 7-day session', async () => {
      const before = Date.now();
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, email: '  John@Example.COM ', hasSeenWelcome: true })
        .expect(201);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: (response.body as RegisterResponse).user.id },
        include: { profile: true, sessions: true },
      });
      expect(user).toMatchObject({
        email: 'john@example.com',
        role: 'USER',
        status: 'ACTIVE',
        termsVersion: '2026-01',
      });
      expect(user.passwordHash).toMatch(/^\$argon2id\$/);
      expect(user.passwordHash).not.toContain(PASSWORD);
      expect(user.termsAcceptedAt.getTime()).toBeGreaterThanOrEqual(before - 1000);
      expect(user.profile).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        hasSeenWelcome: true,
        matchingPreferences: null,
      });
      const ttl = user.sessions[0]!.expiresAt.getTime() - user.sessions[0]!.createdAt.getTime();
      expect(ttl).toBe(7 * 24 * 60 * 60 * 1000);
      expect(JSON.stringify(user)).not.toContain('confirmPassword');
    });

    it.each(['İstanbul@example.com', 'ΑΣ@example.com', 'ÀÉÎ@example.com', 'ß@example.com'])(
      'accepts the non-ASCII email %s and stores it lowercased, never a 500',
      async (email) => {
        await request(app.getHttpServer())
          .post('/api/v1/auth/register')
          .send({ ...validBody, email })
          .expect(201);

        const stored = await prisma.user.findFirstOrThrow();
        expect(stored.email).toBe(email.trim().toLowerCase());
      },
    );

    it('ignores unknown fields such as role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, role: 'ADMIN', status: 'SUSPENDED' })
        .expect(201);

      const user = await prisma.user.findUniqueOrThrow({
        where: { id: (response.body as RegisterResponse).user.id },
      });
      expect(user).toMatchObject({ role: 'USER', status: 'ACTIVE' });
    });
  });

  describe('Given an email that is already registered', () => {
    it('responds 409 without exposing anything about the existing account', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validBody).expect(201);

      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, firstName: 'Mallory', email: 'JOHN@example.com' })
        .expect(409);

      const body = response.body as ErrorResponse;
      expect(body).toMatchObject({ statusCode: 409, error: 'Conflict' });
      expect(body.message).toMatch(/email.*in use/i);
      expect(JSON.stringify(body)).not.toMatch(/John|Doe|id|hash/);
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await prisma.user.count()).toBe(1);
    });
  });

  describe('Given invalid data', () => {
    const cases: Array<[string, Partial<Record<keyof RegisterRequest, unknown>>, string, string]> =
      [
        [
          'mismatching confirmation',
          { confirmPassword: 'another-passphrase' },
          'confirmPassword',
          'MISMATCH',
        ],
        [
          'password shorter than 8 characters',
          { password: 'short12', confirmPassword: 'short12' },
          'password',
          'TOO_SHORT',
        ],
        ['terms not accepted', { termsAccepted: false }, 'termsAccepted', 'MUST_BE_TRUE'],
        ['terms missing', { termsAccepted: undefined }, 'termsAccepted', 'MUST_BE_TRUE'],
        ['empty first name', { firstName: '' }, 'firstName', 'REQUIRED'],
        ['blank last name', { lastName: '   ' }, 'lastName', 'REQUIRED'],
        ['missing email', { email: undefined }, 'email', 'REQUIRED'],
        ['malformed email', { email: 'not-an-email' }, 'email', 'INVALID_FORMAT'],
      ];

    it.each(cases)('responds 400 for %s', async (_name, patch, field, code) => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, ...patch })
        .expect(400);

      const body = response.body as ErrorResponse;
      expect(body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(body.details).toEqual(
        expect.arrayContaining([expect.objectContaining({ field, code })]),
      );
      expect(response.headers['set-cookie']).toBeUndefined();
      expect(await prisma.user.count()).toBe(0);
    });

    it('reports a specific error for every empty required field', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({})
        .expect(400);

      const fields = (response.body as ErrorResponse).details!.map((d) => d.field);
      expect(fields).toEqual(
        expect.arrayContaining([
          'firstName',
          'lastName',
          'email',
          'password',
          'confirmPassword',
          'termsAccepted',
        ]),
      );
    });

    it('rejects values of the wrong type', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, firstName: 42, termsAccepted: 'yes' })
        .expect(400);

      expect((response.body as ErrorResponse).details).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'firstName', code: 'INVALID_TYPE' }),
          expect.objectContaining({ field: 'termsAccepted', code: 'INVALID_TYPE' }),
        ]),
      );
    });

    it('never echoes the submitted password in the error body', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, password: 'short12', confirmPassword: 'different-1' })
        .expect(400);

      expect(JSON.stringify(response.body)).not.toMatch(/short12|different-1/);
    });
  });

  describe('Given an unexpected failure', () => {
    it('responds 500 with a generic message and logs no password or internal detail to the client', async () => {
      const failing = await createApp((builder) =>
        builder.overrideProvider(ACCOUNT_REGISTRATION_REPOSITORY).useValue({
          register: () =>
            Promise.reject(new Error(`connection to db failed (password=${PASSWORD})`)),
        }),
      );

      const response = await request(failing.getHttpServer())
        .post('/api/v1/auth/register')
        .send({ ...validBody, email: 'other@example.com' })
        .expect(500);
      await failing.close();

      expect(response.body).toEqual({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      });
      expect(JSON.stringify(response.body)).not.toContain('connection to db');
    });
  });

  describe('Logging', () => {
    it('writes no password, hash or token to the logs, even when registration fails', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(validBody)
        .expect(201);
      await request(app.getHttpServer()).post('/api/v1/auth/register').send(validBody).expect(409);

      const cookie = (response.headers['set-cookie'] as unknown as string[])[0]!;
      const refreshToken = /^refresh_token=([^;]+);/.exec(cookie)![1]!;
      const user = await prisma.user.findFirstOrThrow();
      expect(output).not.toContain(PASSWORD);
      expect(output).not.toContain(refreshToken);
      expect(output).not.toContain((response.body as RegisterResponse).authentication.accessToken);
      expect(output).not.toContain(user.passwordHash);
    });
  });

  describe('Errors raised before reaching the controller', () => {
    it('answers a malformed JSON body with the stable 400 shape, without parser details', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .set('Content-Type', 'application/json')
        .send('{bad')
        .expect(400);

      expect(response.body).toEqual({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request could not be processed',
      });
    });

    it('answers an unknown route with the stable 404 shape', async () => {
      const response = await request(app.getHttpServer()).get('/api/v1/nope').expect(404);

      expect(response.body).toEqual({
        statusCode: 404,
        error: 'Not Found',
        message: 'Request could not be processed',
      });
    });
  });

  describe('OpenAPI', () => {
    it('documents the endpoint, its responses and the refresh cookie', () => {
      const document = buildOpenApiDocument(app);

      const operation = document.paths['/api/v1/auth/register']?.post;
      expect(operation).toBeDefined();
      expect(Object.keys(operation!.responses)).toEqual(
        expect.arrayContaining(['201', '400', '409', '500']),
      );
      expect(JSON.stringify(operation)).toContain('refresh_token');
    });
  });

  describe('CORS', () => {
    it('allows credentialed requests from the configured web origin only', async () => {
      const allowed = await request(app.getHttpServer())
        .options('/api/v1/auth/register')
        .set('Origin', WEB_ORIGIN)
        .set('Access-Control-Request-Method', 'POST');
      expect(allowed.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(allowed.headers['access-control-allow-credentials']).toBe('true');

      const denied = await request(app.getHttpServer())
        .options('/api/v1/auth/register')
        .set('Origin', 'https://evil.example')
        .set('Access-Control-Request-Method', 'POST');
      // The API only ever advertises the configured origin, so a browser on any other origin
      // fails the CORS check.
      expect(denied.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
      expect(denied.headers['access-control-allow-origin']).not.toBe('https://evil.example');
    });
  });
});
