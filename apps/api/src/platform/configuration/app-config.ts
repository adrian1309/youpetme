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
    /** Absolute lifetime of a session from its creation (SCRUM-54), SESSION_ABSOLUTE_EXPIRATION. */
    sessionMaxAgeMs: number;
  };
  termsVersion: string;
  refreshCookie: {
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  };
  /** How transactional emails leave the API (ADR-014); only Resend in production. */
  email: EmailDeliveryConfig;
  passwordReset: {
    /** Lifetime of a password reset link (TS-IAM-004), PASSWORD_RESET_EXPIRATION. */
    ttlMs: number;
  };
  /** Which AIProvider adapter backs the assistant (ADR-011); only Anthropic in production. */
  ai: AiProviderConfig;
  assistant: {
    /** Chat requests allowed per client IP and minute, ASSISTANT_RATE_LIMIT_PER_MINUTE. */
    rateLimitPerMinute: number;
  };
}

export type AiProviderConfig =
  | { provider: 'anthropic'; apiKey: string; model: string }
  /** Development and automated tests: predictable answers, no network calls. */
  | { provider: 'fake' };

/** The cheapest current Claude model that handles a short tool-using chat. */
const DEFAULT_AI_MODEL = 'claude-haiku-5-5';

export type EmailDeliveryConfig =
  | { delivery: 'resend'; resendApiKey: string; from: string }
  /** Development: prints each email to the API log instead of sending it. */
  | { delivery: 'console' }
  /** Automated tests: writes each email as a JSON file into `outboxDir`. */
  | { delivery: 'file'; outboxDir: string };

const MIN_SECRET_LENGTH = 32;
const PLACEHOLDER_PREFIX = 'change-me';
const EXAMPLE_TERMS_VERSION = 'example-version-replace-me';

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
    NODE_ENV: z.string().optional(),
    DATABASE_URL: z.string().min(1),
    API_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    WEB_ORIGIN: z.string().min(1),
    JWT_ACCESS_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_REFRESH_SECRET: z.string().min(MIN_SECRET_LENGTH),
    JWT_ACCESS_EXPIRATION: duration,
    JWT_REFRESH_EXPIRATION: duration,
    // However often a session is refreshed, it ends this long after sign-in (SCRUM-54).
    SESSION_ABSOLUTE_EXPIRATION: z.string().default('30d').pipe(duration),
    TERMS_VERSION: z.string().min(1),
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
    COOKIE_SAMESITE: z.enum(['Strict', 'Lax', 'None']).default('Strict'),
    // ADR-014: console in development, file in automated tests, Resend in production.
    EMAIL_DELIVERY: z.enum(['resend', 'console', 'file']).default('console'),
    RESEND_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM: z.string().min(1).optional(),
    EMAIL_OUTBOX_DIR: z.string().min(1).optional(),
    PASSWORD_RESET_EXPIRATION: z.string().default('2h').pipe(duration),
    // ADR-011: fake in development and automated tests, Anthropic in production.
    AI_PROVIDER: z.enum(['anthropic', 'fake']).default('fake'),
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    AI_MODEL: z.string().min(1).default(DEFAULT_AI_MODEL),
    ASSISTANT_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  })
  .refine((env) => env.COOKIE_SAMESITE !== 'None' || env.COOKIE_SECURE, {
    path: ['COOKIE_SAMESITE'],
    message: 'SameSite=None requires COOKIE_SECURE=true',
  })
  .superRefine((env, ctx) => {
    const required = {
      resend: ['RESEND_API_KEY', 'EMAIL_FROM'],
      file: ['EMAIL_OUTBOX_DIR'],
      console: [],
    } as const;
    for (const name of required[env.EMAIL_DELIVERY]) {
      if (env[name] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: `is required when EMAIL_DELIVERY=${env.EMAIL_DELIVERY}`,
        });
      }
    }
  })
  .refine((env) => env.AI_PROVIDER !== 'anthropic' || env.ANTHROPIC_API_KEY !== undefined, {
    path: ['ANTHROPIC_API_KEY'],
    message: 'is required when AI_PROVIDER=anthropic',
  })
  // Outside local development the values shipped in .env.example must not be usable (ARCH-001).
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Printed or captured emails carry live reset links: production only ever sends them.
    if (env.EMAIL_DELIVERY !== 'resend') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_DELIVERY'],
        message: 'must be resend in production',
      });
    }
    // The fake assistant answers from fixed rules, never from the catalogue the user sees.
    if (env.AI_PROVIDER !== 'anthropic') {
      ctx.addIssue({
        code: 'custom',
        path: ['AI_PROVIDER'],
        message: 'must be anthropic in production',
      });
    }
    for (const name of ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'] as const) {
      if (env[name].startsWith(PLACEHOLDER_PREFIX)) {
        ctx.addIssue({
          code: 'custom',
          path: [name],
          message: 'must not be a placeholder in production',
        });
      }
    }
    if (env.TERMS_VERSION === EXAMPLE_TERMS_VERSION) {
      ctx.addIssue({
        code: 'custom',
        path: ['TERMS_VERSION'],
        message: 'must be the real version of the published texts in production',
      });
    }
    if (!env.COOKIE_SECURE) {
      ctx.addIssue({
        code: 'custom',
        path: ['COOKIE_SECURE'],
        message: 'must be true in production',
      });
    }
  })
  // A cap shorter than the refresh window would cancel the sliding window out.
  .refine((env) => env.SESSION_ABSOLUTE_EXPIRATION >= env.JWT_REFRESH_EXPIRATION, {
    path: ['SESSION_ABSOLUTE_EXPIRATION'],
    message: 'must be at least JWT_REFRESH_EXPIRATION',
  })
  // A refresh token signed with the access secret could be replayed as an access token.
  .refine((env) => env.JWT_ACCESS_SECRET !== env.JWT_REFRESH_SECRET, {
    path: ['JWT_REFRESH_SECRET'],
    message: 'must differ from JWT_ACCESS_SECRET',
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
      sessionMaxAgeMs: values.SESSION_ABSOLUTE_EXPIRATION,
    },
    termsVersion: values.TERMS_VERSION,
    refreshCookie: { secure: values.COOKIE_SECURE, sameSite: values.COOKIE_SAMESITE },
    email: emailDelivery(values),
    passwordReset: { ttlMs: values.PASSWORD_RESET_EXPIRATION },
    ai: aiProvider(values),
    assistant: { rateLimitPerMinute: values.ASSISTANT_RATE_LIMIT_PER_MINUTE },
  };
}

function aiProvider(values: z.infer<typeof envSchema>): AiProviderConfig {
  return values.AI_PROVIDER === 'anthropic'
    ? { provider: 'anthropic', apiKey: values.ANTHROPIC_API_KEY!, model: values.AI_MODEL }
    : { provider: 'fake' };
}

/** The refinements above guarantee the variables each mode needs. */
function emailDelivery(values: z.infer<typeof envSchema>): EmailDeliveryConfig {
  switch (values.EMAIL_DELIVERY) {
    case 'resend':
      return { delivery: 'resend', resendApiKey: values.RESEND_API_KEY!, from: values.EMAIL_FROM! };
    case 'file':
      return { delivery: 'file', outboxDir: values.EMAIL_OUTBOX_DIR! };
    case 'console':
      return { delivery: 'console' };
  }
}
