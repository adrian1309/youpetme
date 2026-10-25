/** One-way digest stored in UserSession.refreshTokenHash; the token itself is never persisted. */
export interface RefreshTokenHasher {
  hash(refreshToken: string): string;
}
