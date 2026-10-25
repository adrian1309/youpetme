import { z } from 'zod';

import type { RegisterUserCommand } from '../../application/commands/register-user.command';

/**
 * Transport-shape validation only: types and presence. Business rules (name, email, password,
 * confirmation, terms) live in the domain and are enforced by the use case, so there is one
 * source of truth. A missing field becomes empty/false and is reported by those rules.
 */
const registerBodySchema = z.object({
  firstName: z.string().default(''),
  lastName: z.string().default(''),
  email: z.string().default(''),
  password: z.string().default(''),
  confirmPassword: z.string().default(''),
  termsAccepted: z.boolean().default(false),
  hasSeenWelcome: z.boolean().optional(),
});

export interface ShapeIssue {
  field: string;
  code: 'INVALID_TYPE';
}

export type ParsedRegisterBody =
  | { ok: true; command: Omit<RegisterUserCommand, 'correlationId'> }
  | { ok: false; issues: ShapeIssue[] };

export function parseRegisterBody(body: unknown): ParsedRegisterBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return { ok: false, issues: [{ field: 'body', code: 'INVALID_TYPE' }] };
  }
  const parsed = registerBodySchema.safeParse(body);
  if (!parsed.success) {
    const fields = new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? 'body')));
    return {
      ok: false,
      issues: [...fields].map((field) => ({ field, code: 'INVALID_TYPE' as const })),
    };
  }
  return { ok: true, command: parsed.data };
}
