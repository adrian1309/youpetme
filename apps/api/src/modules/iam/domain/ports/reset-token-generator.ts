/** Creates the secret sent in the reset link. Only its hash is ever stored. */
export interface ResetTokenGenerator {
  generate(): string;
}
