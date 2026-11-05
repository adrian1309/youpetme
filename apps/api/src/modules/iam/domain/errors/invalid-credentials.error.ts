/**
 * Unknown email or wrong password. Deliberately one error for both, so neither the response nor
 * the code path tells which one failed (TS-IAM-002, account enumeration).
 */
export class InvalidCredentialsError extends Error {
  constructor() {
    super('Invalid credentials');
    this.name = 'InvalidCredentialsError';
  }
}
