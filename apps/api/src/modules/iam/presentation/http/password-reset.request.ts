import { z } from 'zod';

import type { RequestPasswordResetCommand } from '../../application/commands/request-password-reset.command';
import type { ResetPasswordCommand } from '../../application/commands/reset-password.command';
import type { ShapeIssue } from './register.request';

/**
 * Transport-shape validation only, as for registration and login: presence, email format and the
 * password policy are business rules checked by the use cases. A missing field becomes empty.
 */
const requestBodySchema = z.object({ email: z.string().default('') });

const confirmBodySchema = z.object({
  token: z.string().default(''),
  password: z.string().default(''),
  confirmPassword: z.string().default(''),
});

export type Parsed<T> = { ok: true; command: T } | { ok: false; issues: ShapeIssue[] };

function parse<T>(schema: z.ZodType<T>, body: unknown): Parsed<T> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: 'body', code: 'INVALID_TYPE' }] };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'body')));
    return {
      ok: false,
      issues: [...fields].map((field) => ({ field, code: 'INVALID_TYPE' as const })),
    };
  }
  return { ok: true, command: parsed.data };
}

export function parsePasswordResetRequestBody(body: unknown): Parsed<RequestPasswordResetCommand> {
  return parse(requestBodySchema, body);
}

export function parsePasswordResetConfirmBody(body: unknown): Parsed<ResetPasswordCommand> {
  return parse(confirmBodySchema, body);
}
