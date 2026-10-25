import * as argon2 from 'argon2';

import type { PasswordHasher } from '../../domain/ports/password-hasher';

/** ADR-002 starting parameters: 19 MiB of memory, 2 iterations, parallelism 1. */
export class Argon2idPasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }
}
