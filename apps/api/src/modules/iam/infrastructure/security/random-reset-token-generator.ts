import { randomBytes } from 'node:crypto';

import type { ResetTokenGenerator } from '../../domain/ports/reset-token-generator';

const TOKEN_BYTES = 32;

/**
 * 256 bits from the OS CSPRNG, URL-safe so it fits in the link unescaped. With that entropy a
 * fast SHA-256 digest is enough to store it (same reasoning as refresh tokens).
 */
export class RandomResetTokenGenerator implements ResetTokenGenerator {
  generate(): string {
    return randomBytes(TOKEN_BYTES).toString('base64url');
  }
}
