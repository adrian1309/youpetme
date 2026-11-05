/** Hides the hashing library and its parameters from the use case (ADR-002: Argon2id). */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
  /**
   * Checks a password against a stored hash. With `null` (no such account) it still performs a
   * full verification against a dummy hash and resolves false, so both paths take as long.
   */
  verify(passwordHash: string | null, plainPassword: string): Promise<boolean>;
}
