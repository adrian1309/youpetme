export interface VerifiedRefreshToken {
  userId: string;
  sessionId: string;
  /** The signature is valid but the token is past its expiry. */
  expired: boolean;
}

/** Checks a refresh token's signature and reads its claims; null when it is not a valid token. */
export interface RefreshTokenVerifier {
  verify(refreshToken: string): Promise<VerifiedRefreshToken | null>;
}
