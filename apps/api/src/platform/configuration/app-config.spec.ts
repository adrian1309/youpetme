import { loadAppConfig } from './app-config';

const validEnv = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/db?schema=public',
  API_PORT: '3000',
  WEB_ORIGIN: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  JWT_ACCESS_EXPIRATION: '15m',
  JWT_REFRESH_EXPIRATION: '7d',
  TERMS_VERSION: '2026-01',
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'Strict',
};

describe('loadAppConfig', () => {
  it('maps the environment into typed configuration, converting durations to milliseconds', () => {
    expect(loadAppConfig(validEnv)).toEqual({
      databaseUrl: validEnv.DATABASE_URL,
      apiPort: 3000,
      webOrigin: 'http://localhost:5173',
      auth: {
        accessSecret: 'a'.repeat(32),
        refreshSecret: 'b'.repeat(32),
        accessTtlMs: 15 * 60 * 1000,
        refreshTtlMs: 7 * 24 * 60 * 60 * 1000,
      },
      termsVersion: '2026-01',
      refreshCookie: { secure: false, sameSite: 'Strict' },
    });
  });

  it('takes the lifetimes from the environment instead of fixed values', () => {
    const config = loadAppConfig({
      ...validEnv,
      JWT_ACCESS_EXPIRATION: '5m',
      JWT_REFRESH_EXPIRATION: '1d',
    });

    expect(config.auth.accessTtlMs).toBe(5 * 60 * 1000);
    expect(config.auth.refreshTtlMs).toBe(24 * 60 * 60 * 1000);
  });

  it.each([
    'DATABASE_URL',
    'WEB_ORIGIN',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'JWT_ACCESS_EXPIRATION',
    'JWT_REFRESH_EXPIRATION',
    'TERMS_VERSION',
  ])('fails at startup when %s is missing', (name) => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env[name];

    expect(() => loadAppConfig(env)).toThrow(name);
  });

  it('rejects secrets shorter than 32 characters without echoing them', () => {
    const attempt = () => loadAppConfig({ ...validEnv, JWT_ACCESS_SECRET: 'too-short-secret' });

    expect(attempt).toThrow('JWT_ACCESS_SECRET');
    expect(attempt).not.toThrow('too-short-secret');
  });

  it('rejects an invalid expiration', () => {
    expect(() => loadAppConfig({ ...validEnv, JWT_REFRESH_EXPIRATION: 'soon' })).toThrow(
      'JWT_REFRESH_EXPIRATION',
    );
  });

  it('defaults the cookie to Secure + Strict when not configured', () => {
    const env: Record<string, string | undefined> = { ...validEnv };
    delete env.COOKIE_SECURE;
    delete env.COOKIE_SAMESITE;

    expect(loadAppConfig(env).refreshCookie).toEqual({ secure: true, sameSite: 'Strict' });
  });

  it('requires Secure when SameSite=None', () => {
    expect(() =>
      loadAppConfig({ ...validEnv, COOKIE_SAMESITE: 'None', COOKIE_SECURE: 'false' }),
    ).toThrow('COOKIE_SAMESITE');
    expect(
      loadAppConfig({ ...validEnv, COOKIE_SAMESITE: 'None', COOKIE_SECURE: 'true' }).refreshCookie,
    ).toEqual({ secure: true, sameSite: 'None' });
  });

  it('rejects an unknown SameSite value', () => {
    expect(() => loadAppConfig({ ...validEnv, COOKIE_SAMESITE: 'Whatever' })).toThrow(
      'COOKIE_SAMESITE',
    );
  });

  it('rejects using the same secret for access and refresh tokens', () => {
    const attempt = () =>
      loadAppConfig({ ...validEnv, JWT_REFRESH_SECRET: validEnv.JWT_ACCESS_SECRET });

    expect(attempt).toThrow('JWT_REFRESH_SECRET');
    expect(attempt).not.toThrow(validEnv.JWT_ACCESS_SECRET);
  });

  describe('in production', () => {
    const production = { ...validEnv, NODE_ENV: 'production', COOKIE_SECURE: 'true' };

    it('accepts a real configuration', () => {
      expect(() => loadAppConfig(production)).not.toThrow();
    });

    it('rejects the placeholder secrets shipped in .env.example', () => {
      expect(() =>
        loadAppConfig({
          ...production,
          JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-characters',
        }),
      ).toThrow('JWT_ACCESS_SECRET');
      expect(() =>
        loadAppConfig({
          ...production,
          JWT_REFRESH_SECRET: 'change-me-refresh-secret-at-least-32-characters',
        }),
      ).toThrow('JWT_REFRESH_SECRET');
    });

    it('rejects a refresh cookie without Secure', () => {
      expect(() => loadAppConfig({ ...production, COOKIE_SECURE: 'false' })).toThrow(
        'COOKIE_SECURE',
      );
    });

    it('rejects the example TERMS_VERSION shipped in .env.example', () => {
      expect(() =>
        loadAppConfig({ ...production, TERMS_VERSION: 'example-version-replace-me' }),
      ).toThrow('TERMS_VERSION');
    });

    it('keeps the same values valid for local development', () => {
      expect(() =>
        loadAppConfig({
          ...validEnv,
          NODE_ENV: 'development',
          JWT_ACCESS_SECRET: 'change-me-access-secret-at-least-32-characters',
          COOKIE_SECURE: 'false',
          TERMS_VERSION: 'example-version-replace-me',
        }),
      ).not.toThrow();
    });
  });
});
