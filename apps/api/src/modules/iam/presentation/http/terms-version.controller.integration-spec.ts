import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { TermsVersionResponse } from '@youpetme/contracts';
import request from 'supertest';

import { AppModule } from '../../../../app/app.module';
import { configureApp } from '../../../../app/configure-app';
import { buildOpenApiDocument } from '../../../../app/openapi';

const WEB_ORIGIN = 'http://localhost:5173';
const TERMS_VERSION = '2026-01';
const ENDPOINT = '/api/v1/legal/terms-version';

/**
 * Boots the real HTTP stack. This endpoint never touches the database (Prisma connects lazily),
 * so no PostgreSQL container is needed; the URL below is never dialled.
 */
describe(`GET ${ENDPOINT}`, () => {
  let app: INestApplication;

  beforeAll(async () => {
    Object.assign(process.env, {
      DATABASE_URL: 'postgresql://unused:unused@localhost:1/unused',
      API_PORT: '3000',
      WEB_ORIGIN,
      JWT_ACCESS_SECRET: 'test-access-secret-0123456789abcdef-test',
      JWT_REFRESH_SECRET: 'test-refresh-secret-0123456789abcdef-test',
      JWT_ACCESS_EXPIRATION: '15m',
      JWT_REFRESH_EXPIRATION: '7d',
      TERMS_VERSION,
      COOKIE_SECURE: 'true',
      COOKIE_SAMESITE: 'Strict',
    });
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, { webOrigin: WEB_ORIGIN });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers 200 with only the version configured in TERMS_VERSION', async () => {
    const response = await request(app.getHttpServer()).get(ENDPOINT).expect(200);

    const body = response.body as TermsVersionResponse;
    expect(body).toEqual({ version: TERMS_VERSION });
    expect(response.headers['set-cookie']).toBeUndefined();
  });

  it('is public: it needs no Origin and accepts the configured web origin', async () => {
    await request(app.getHttpServer()).get(ENDPOINT).expect(200);
    const response = await request(app.getHttpServer())
      .get(ENDPOINT)
      .set('Origin', WEB_ORIGIN)
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(WEB_ORIGIN);
  });

  it('is documented in OpenAPI', () => {
    const document = buildOpenApiDocument(app);

    const operation = document.paths[ENDPOINT]?.get;
    expect(operation).toBeDefined();
    expect(Object.keys(operation!.responses)).toContain('200');
  });
});
