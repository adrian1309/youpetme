/**
 * The password reset link cannot be used: unknown, already used, expired, superseded by a newer
 * link, or its account is no longer ACTIVE. One error for every case, so nothing about the
 * account or the link leaks (TS-IAM-004).
 */
export class ResetTokenInvalidError extends Error {
  constructor() {
    super('Reset token invalid');
    this.name = 'ResetTokenInvalidError';
  }
}
