import { randomUUID } from 'node:crypto';

import { JwtService, TokenExpiredError } from '@nestjs/jwt';

import type {
  RefreshTokenVerifier,
  VerifiedRefreshToken,
} from '../../domain/ports/refresh-token-verifier';
import type { TokenIssuer } from '../../domain/ports/token-issuer';
import type { Role } from '../../domain/value-objects/account-states';

export interface JwtTokenIssuerOptions {
  accessSecret: string;
  refreshSecret: string;
  accessTtlMs: number;
  refreshTtlMs: number;
}

interface RefreshClaims {
  sub?: unknown;
  sid?: unknown;
}

/** HS256 JWTs; lifetimes come from configuration (ADR-002), each token type has its own secret. */
export class JwtTokenIssuer implements TokenIssuer, RefreshTokenVerifier {
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

  /**
   * Only HS256 tokens signed with the refresh secret are accepted, so neither an access token nor
   * an unsigned token can be used here. An expired token still yields its claims, flagged, so the
   * session it belongs to can be marked EXPIRED.
   */
  async verify(refreshToken: string): Promise<VerifiedRefreshToken | null> {
    const options = { secret: this.options.refreshSecret, algorithms: ['HS256' as const] };
    try {
      return toVerified(await this.jwt.verifyAsync<RefreshClaims>(refreshToken, options), false);
    } catch (error) {
      if (!(error instanceof TokenExpiredError)) {
        return null;
      }
    }
    try {
      const claims = await this.jwt.verifyAsync<RefreshClaims>(refreshToken, {
        ...options,
        ignoreExpiration: true,
      });
      return toVerified(claims, true);
    } catch {
      return null;
    }
  }
}

function toVerified(claims: RefreshClaims, expired: boolean): VerifiedRefreshToken | null {
  if (typeof claims.sub !== 'string' || typeof claims.sid !== 'string') {
    return null;
  }
  return { userId: claims.sub, sessionId: claims.sid, expired };
}
