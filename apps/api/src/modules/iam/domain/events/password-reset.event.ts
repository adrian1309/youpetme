/**
 * Published after a password reset has been committed (TS-IAM-004). Never carries the token, the
 * password or any hash.
 */
export class PasswordReset {
  constructor(
    readonly userId: string,
    readonly occurredAt: Date,
  ) {}
}
