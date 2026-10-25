import { createHash } from 'node:crypto';

import type { RefreshTokenHasher } from '../../domain/ports/refresh-token-hasher';

/** Refresh tokens are high-entropy signed values, so a fast digest is enough (no Argon2). */
export class Sha256RefreshTokenHasher implements RefreshTokenHasher {
  hash(refreshToken: string): string {
    return createHash('sha256').update(refreshToken).digest('hex');
  }
}
