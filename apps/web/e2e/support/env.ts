/**
 * The whole E2E environment, passed explicitly so nothing comes from the development .env
 * (ARCH-002: E2E tests never target a development database). Every value is fictitious and only
 * lives for the duration of a run.
 *
 * Always `localhost`, never 127.0.0.1: the refresh-token cookie is SameSite=Strict, so the web app
 * and the API must stay same-site.
 */
export const WEB_ORIGIN = 'http://localhost:5173';

const API_PORT = '3000';
export const API_URL = `http://localhost:${API_PORT}`;

const POSTGRES_USER = 'youpetme_e2e';
const POSTGRES_PASSWORD = 'e2e-only-password';
const POSTGRES_DB = 'youpetme_e2e';
const POSTGRES_PORT = '5433';

export const POSTGRES_ENV = { POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB, POSTGRES_PORT };

export const API_ENV = {
  // Not `production`: app-config.ts rejects COOKIE_SECURE=false there, and the readiness URL below
  // is only served outside production.
  NODE_ENV: 'test',
  DATABASE_URL: `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}?schema=public`,
  API_PORT,
  WEB_ORIGIN,
  JWT_ACCESS_SECRET: 'e2e-only-access-secret-0123456789abcdef',
  JWT_REFRESH_SECRET: 'e2e-only-refresh-secret-0123456789abcdef',
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '7d',
  TERMS_VERSION: 'e2e-terms-version',
  // The stack runs over http://localhost.
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'Strict',
};

/** There is no health endpoint yet; Swagger UI answers once the API is listening. */
export const API_READY_URL = `${API_URL}/api/v1/docs`;
