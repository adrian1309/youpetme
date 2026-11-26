import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { LoginResponse, RegisterResponse } from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../platform/database/testing/test-database';

const WEB_ORIGIN = 'http://localhost:5173';
const PASSWORD = 'my-secure-passphrase';
const EMAIL = 'john@example.com';
const WELCOME_SEEN = '/api/v1/users/me/welcome-seen';

describe("PUT /api/v1/users/me/welcome-seen (Diango's welcome, SCRUM-17)", () => {
  let db: TestDatabase;
  let app: INestApplication;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    db = await startTestDatabase();
    Object.assign(process.env, {
      DATABASE_URL: db.connectionUri,
      API_PORT: '3000',
      WEB_ORIGIN,
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef-test',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef-test',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION: '2026-01',
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { webOrigin: WEB_ORIGIN });
    await app.init();
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await app.close();
    await db.stop();
  });

  it('records the welcome as seen, idempotently, and login then reports it', async () => {
    const registered = await http()
      .post('/api/v1/auth/register')
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: EMAIL,
        password: PASSWORD,
        confirmPassword: PASSWORD,
        termsAccepted: true,
      })
      .expect(201);
    const { user, authentication } = registered.body as RegisterResponse;
    expect(user.hasSeenWelcome).toBe(false);
    const bearer = `Bearer ${authentication.accessToken}`;

    await http().put(WELCOME_SEEN).set('Authorization', bearer).expect(204);
    await http().put(WELCOME_SEEN).set('Authorization', bearer).expect(204);

    const profile = await db.prisma.userProfile.findUniqueOrThrow({ where: { userId: user.id } });
    expect(profile.hasSeenWelcome).toBe(true);
    const login = await http()
      .post('/api/v1/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);
    expect((login.body as LoginResponse).user.hasSeenWelcome).toBe(true);
  });

  it('requires an access token', async () => {
    await http().put(WELCOME_SEEN).expect(401);
  });
});
