export interface IamConfig {
  /** Version of the Terms of Service and Privacy Policy accepted at registration. */
  readonly termsVersion: string;
  /** Lifetime of a refresh token / session, from JWT_REFRESH_EXPIRATION. */
  readonly refreshTokenTtlMs: number;
  /** Absolute lifetime of a session from its creation, from SESSION_ABSOLUTE_EXPIRATION. */
  readonly sessionMaxAgeMs: number;
}
