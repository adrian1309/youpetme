/** Hides the hashing library and its parameters from the use case (ADR-002: Argon2id). */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>;
}
