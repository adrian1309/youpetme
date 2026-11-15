/** One-way digest stored in PasswordResetToken.tokenHash; the token itself is never persisted. */
export interface ResetTokenHasher {
  hash(token: string): string;
}
