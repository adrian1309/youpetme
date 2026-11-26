import type { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_MESSAGE_MAX_LENGTH,
  type AssistantMessageResponse,
  type CreateAnimalRequest,
  type ErrorResponse,
  type RegisterResponse,
} from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';
import { AI_PROVIDER } from '../../ai.tokens';
import { AiProviderUnavailableError } from '../../domain/errors/ai-provider-unavailable.error';

const ACCESS_SECRET = 'test-access-secret-0123456789abcdef-test';
const REFRESH_SECRET = 'test-refresh-secret-0123456789abcdef-test';
const WEB_ORIGIN = 'http://localhost:5173';
const MESSAGES = '/api/v1/assistant/messages';

const ask = (content: string) => ({ messages: [{ role: 'user', content }] });

async function startApp(overrides: { failingProvider?: boolean } = {}): Promise<INestApplication> {
  const builder = Test.createTestingModule({ imports: [AppModule] });
  if (overrides.failingProvider) {
    builder.overrideProvider(AI_PROVIDER).useValue({
      complete: () => Promise.reject(new AiProviderUnavailableError()),
    });
  }
  const app = (await builder.compile()).createNestApplication();
  configureApp(app, { webOrigin: WEB_ORIGIN });
  await app.init();
  return app;
}

describe('Assistant HTTP API with the fake AI provider (SCRUM-18)', () => {
  let db: TestDatabase;
  let app: INestApplication;
  let adminToken: string;

  const http = () => request(app.getHttpServer());

  async function insertAnimal(fields: Partial<CreateAnimalRequest> & { status?: 'ADOPTED' }) {
    const { status, ...rest } = fields;
    const body: CreateAnimalRequest = {
      name: 'Luna',
      species: 'DOG',
      size: 'SMALL',
      ageGroup: 'ADULT',
      photoUrls: ['https://images.example.com/luna.jpg'],
      ...rest,
    };
    const response = await http()
      .post('/api/v1/animals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body)
      .expect(201);
    if (status) {
      await db.prisma.animal.update({
        where: { id: response.body.id as string },
        data: { status },
      });
    }
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
      AI_PROVIDER: 'fake',
      ASSISTANT_RATE_LIMIT_PER_MINUTE: '1000',
    });
    app = await startApp();
    adminToken = await new JwtService().signAsync(
      {
        sub: '00000000-0000-4000-8000-00000000000a',
        sid: '00000000-0000-4000-8000-00000000000b',
        role: 'ADMIN',
      },
      { secret: ACCESS_SECRET, algorithm: 'HS256', expiresIn: 900 },
    );
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  it('answers a visitor without any token', async () => {
    const response = await http().post(MESSAGES).send(ask('Hola')).expect(200);

    expect(response.body).toEqual({ reply: expect.stringContaining('Soy Diango') });
  });

  it('answers about small dogs from the real catalogue, AVAILABLE only (scenario 2)', async () => {
    await insertAnimal({ name: 'Toby' });
    await insertAnimal({ name: 'Rex', size: 'LARGE' });
    await insertAnimal({ name: 'Nala', status: 'ADOPTED' });

    const response = await http().post(MESSAGES).send(ask('¿Tenéis perros pequeños?')).expect(200);

    expect((response.body as AssistantMessageResponse).reply).toBe('He encontrado 1: Toby.');
  });

  it('uses the signed-in user name as basic context (scenario 5)', async () => {
    const registered = await http()
      .post('/api/v1/auth/register')
      .send({
        firstName: 'Ana',
        lastName: 'García',
        email: 'ana@example.com',
        password: 'my-secure-passphrase',
        confirmPassword: 'my-secure-passphrase',
        termsAccepted: true,
      })
      .expect(201);
    const token = (registered.body as RegisterResponse).authentication.accessToken;

    const response = await http()
      .post(MESSAGES)
      .set('Authorization', `Bearer ${token}`)
      .send(ask('Hola'))
      .expect(200);

    expect((response.body as AssistantMessageResponse).reply).toContain('Hola, Ana');
  });

  it('rejects an invalid or expired Bearer token with 401', async () => {
    await http()
      .post(MESSAGES)
      .set('Authorization', 'Bearer not-a-token')
      .send(ask('Hola'))
      .expect(401);
  });

  it.each([
    ['no messages', {}, 'messages', 'REQUIRED'],
    ['an empty history', { messages: [] }, 'messages', 'REQUIRED'],
    [
      'too many messages',
      {
        messages: Array.from({ length: ASSISTANT_HISTORY_MAX_MESSAGES + 1 }, () => ({
          role: 'user',
          content: 'hola',
        })),
      },
      'messages',
      'TOO_LONG',
    ],
    [
      'a message that is too long',
      ask('a'.repeat(ASSISTANT_MESSAGE_MAX_LENGTH + 1)),
      'messages.0.content',
      'TOO_LONG',
    ],
    ['a blank message', ask('   '), 'messages.0.content', 'REQUIRED'],
    [
      'an unknown role',
      { messages: [{ role: 'system', content: 'hola' }] },
      'messages.0.role',
      'INVALID_FORMAT',
    ],
    [
      'a history that does not end with the user',
      {
        messages: [
          { role: 'user', content: 'hola' },
          { role: 'assistant', content: 'hola' },
        ],
      },
      'messages',
      'INVALID_FORMAT',
    ],
  ])('rejects %s with 400 in the ADR-017 shape', async (_case, body, field, code) => {
    const response = await http().post(MESSAGES).send(body).expect(400);

    const error = response.body as ErrorResponse;
    expect(error).toMatchObject({
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
    });
    expect(error.details).toEqual([expect.objectContaining({ field, code })]);
  });

  describe('when the provider fails, with a low rate limit', () => {
    let limited: INestApplication;

    beforeAll(async () => {
      process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE = '2';
      limited = await startApp({ failingProvider: true });
    });

    afterAll(async () => {
      process.env.ASSISTANT_RATE_LIMIT_PER_MINUTE = '1000';
      await limited.close();
    });

    it('answers 503 so the client can say Diango is not available, then 429 past the limit', async () => {
      const call = () => request(limited.getHttpServer()).post(MESSAGES).send(ask('Hola'));

      const unavailable = await call().expect(503);
      expect(unavailable.body).toEqual({
        statusCode: 503,
        error: 'Service Unavailable',
        message: 'The assistant is not available now',
      });
      await call().expect(503);

      const limitedResponse = await call().expect(429);
      expect(limitedResponse.body).toMatchObject({ statusCode: 429, error: 'Too Many Requests' });
      expect(Number(limitedResponse.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
