import { z } from 'zod';

import type { LoginUserCommand } from '../../application/commands/login-user.command';
import type { ShapeIssue } from './register.request';

/**
 * Transport-shape validation only, as for registration: presence and email format are business
 * rules checked by the use case. A missing field becomes empty and is reported there.
 */
const loginBodySchema = z.object({
  email: z.string().default(''),
  password: z.string().default(''),
});

export type ParsedLoginBody =
  | { ok: true; command: Omit<LoginUserCommand, 'correlationId'> }
  | { ok: false; issues: ShapeIssue[] };

export function parseLoginBody(body: unknown): ParsedLoginBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: 'body', code: 'INVALID_TYPE' }] };
  }
  const parsed = loginBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'body')));
    return {
      ok: false,
      issues: [...fields].map((field) => ({ field, code: 'INVALID_TYPE' as const })),
    };
  }
  return { ok: true, command: parsed.data };
}
