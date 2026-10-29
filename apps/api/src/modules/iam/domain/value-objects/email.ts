import { ValidationFailedError, type ValidationIssue } from '../errors/validation-failed.error';

const MAX_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** A normalized (trimmed, lowercase) email address; the form used for lookup and storage. */
export class Email {
  private constructor(readonly value: string) {}

  static normalize(raw: string): string {
    return raw.trim().toLowerCase();
  }

  static validate(raw: string): ValidationIssue[] {
    const normalized = Email.normalize(raw);
    if (normalized.length === 0) {
      return [{ field: 'email', code: 'REQUIRED' }];
    }
    // The length check runs first so the pattern is never applied to oversized input.
    if (normalized.length > MAX_LENGTH) {
      return [{ field: 'email', code: 'TOO_LONG' }];
    }
    if (!EMAIL_PATTERN.test(normalized)) {
      return [{ field: 'email', code: 'INVALID_FORMAT' }];
    }
    return [];
  }

  static create(raw: string): Email {
    const issues = Email.validate(raw);
    if (issues.length > 0) {
      throw new ValidationFailedError(issues);
    }
    return new Email(Email.normalize(raw));
  }
}
