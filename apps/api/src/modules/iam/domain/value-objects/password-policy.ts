import type { ValidationIssue } from '../errors/validation-failed.error';

/** Password policy of ADR-002: length only, no complexity rules. The server is the source of truth. */
export const PasswordPolicy = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,

  validate(password: string): ValidationIssue[] {
    if (password.length === 0) {
      return [{ field: 'password', code: 'REQUIRED' }];
    }
    if (password.length < PasswordPolicy.MIN_LENGTH) {
      return [{ field: 'password', code: 'TOO_SHORT' }];
    }
    if (password.length > PasswordPolicy.MAX_LENGTH) {
      return [{ field: 'password', code: 'TOO_LONG' }];
    }
    return [];
  },
} as const;
