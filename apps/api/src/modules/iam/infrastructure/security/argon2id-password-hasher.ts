import { randomUUID } from 'node:crypto';

import * as argon2 from 'argon2';

import type { PasswordHasher } from '../../domain/ports/password-hasher';

/** ADR-002 starting parameters: 19 MiB of memory, 2 iterations, parallelism 1. */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export class Argon2idPasswordHasher implements PasswordHasher {
  /** Hash of a random value, made once with the same parameters; compared when there is no user. */
  private dummyHash: Promise<string> | undefined;

  hash(plainPassword: string): Promise<string> {
    return argon2.hash(plainPassword, OPTIONS);
  }

  async verify(passwordHash: string | null, plainPassword: string): Promise<boolean> {
    if (passwordHash === null) {
      await this.safeVerify(await this.getDummyHash(), plainPassword);
      return false;
    }
    return this.safeVerify(passwordHash, plainPassword);
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomUUID(), OPTIONS);
    return this.dummyHash;
  }

  /** A malformed stored hash is a mismatch, never an unexpected error. */
  private async safeVerify(passwordHash: string, plainPassword: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, plainPassword);
    } catch {
      return false;
    }
  }
}
