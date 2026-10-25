import { z } from 'zod';

import { parseDurationMs } from './duration';

export interface AppConfig {
  databaseUrl: string;
  apiPort: number;
  webOrigin: string;
  auth: {
    accessSecret: string;
    refreshSecret: string;
    accessTtlMs: number;
    refreshTtlMs: number;
  };
  termsVersion: string;
  refreshCookie: {
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  };
}

const MIN_SECRET_LENGTH = 32;

const duration = z.string().transform((value, ctx) => {
  try {
    return parseDurationMs(value);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'must look like 15m, 2h or 7d' });
    return z.NEVER;
  }
});

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEB_ORIGIN: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_EXPIRATION: duration,
    JWT_REFRESH_EXPIRATION: duration,
    TERMS_VERSION: z.string().min(1),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    COOKIE_SAMESITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
  })
  .refine((env) => env.COOKIE_SAMESITE !== 'None' || env.COOKIE_SECURE, {
    path: ['COOKIE_SAMESITE'],
    message: 'SameSite=None requires COOKIE_SECURE=true',
  });

/**
 * Validates the environment once at startup. Error messages name the variable but never echo
 * its value, so a misconfigured secret does not end up in logs.
 */
export function loadAppConfig(env: Record<string, string | undefined>): AppConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid configuration: ${problems}`);
  }

  const values = parsed.data;
  return {
    databaseUrl: values.DATABASE_URL,
    apiPort: values.API_PORT,
    webOrigin: values.WEB_ORIGIN,
    auth: {
      accessSecret: values.JWT_ACCESS_SECRET,
      refreshSecret: values.JWT_REFRESH_SECRET,
      accessTtlMs: values.JWT_ACCESS_EXPIRATION,
      refreshTtlMs: values.JWT_REFRESH_EXPIRATION,
    },
    termsVersion: values.TERMS_VERSION,
    refreshCookie: { secure: values.COOKIE_SECURE, sameSite: values.COOKIE_SAMESITE },
  };
}
