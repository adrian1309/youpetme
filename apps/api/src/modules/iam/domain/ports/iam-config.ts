export interface IamConfig {
  /** Version of the Terms of Service and Privacy Policy accepted at registration. */
  readonly termsVersion: string;
  /** Lifetime of a refresh token / session, from JWT_REFRESH_EXPIRATION. */
  readonly refreshTokenTtlMs: number;
  /** Absolute lifetime of a session from its creation, from SESSION_ABSOLUTE_EXPIRATION. */
  readonly sessionMaxAgeMs: number;
  /** Lifetime of a password reset link, from PASSWORD_RESET_EXPIRATION (TS-IAM-004). */
  readonly passwordResetTtlMs: number;
  /** A new link is not sent while the account's previous one is younger than this. */
  readonly passwordResetCooldownMs: number;
  /** Page of the web app the reset link opens; the token goes in its `token` query parameter. */
  readonly resetPasswordUrl: string;
}
