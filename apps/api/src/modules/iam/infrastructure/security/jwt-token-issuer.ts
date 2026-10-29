import { randomUUID } from 'node:crypto';

import { JwtService } from '@nestjs/jwt';

import type { TokenIssuer } from '../../domain/ports/token-issuer';
import type { Role } from '../../domain/value-objects/account-states';

export interface JwtTokenIssuerOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtlMs: number;
  refreshTtlMs: number;
}

/** HS256 JWTs; lifetimes come from configuration (ADR-002), each token type has its own secret. */
export class JwtTokenIssuer implements TokenIssuer {
  private readonly jwt = new JwtService();

  constructor(private readonly options: JwtTokenIssuerOptions) {}

  issueAccessToken(claims: { userId: string; sessionId: string; role: Role }): Promise<string> {
    return this.jwt.signAsync(
      { sub: claims.userId, sid: claims.sessionId, role: claims.role },
      {
        secret: this.options.accessSecret,
        algorithm: 'HS256',
        expiresIn: this.options.accessTtlMs / 1000,
      },
    );
  }

  issueRefreshToken(claims: { userId: string; sessionId: string }): Promise<string> {
    return this.jwt.signAsync(
      { sub: claims.userId, sid: claims.sessionId, jti: randomUUID() },
      {
        secret: this.options.refreshSecret,
        algorithm: 'HS256',
        expiresIn: this.options.refreshTtlMs / 1000,
      },
    );
  }
}
