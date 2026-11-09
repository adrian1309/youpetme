import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';

import type {
  AccessTokenVerifier,
  VerifiedAccessToken,
} from '../../domain/ports/access-token-verifier';
import { ACCESS_TOKEN_VERIFIER } from '../../iam.tokens';

const AUTHENTICATED_USER = Symbol('authenticatedUser');

interface GuardedRequest {
  headers: Record<string, string | undefined>;
  [AUTHENTICATED_USER]?: VerifiedAccessToken;
}

/**
 * Requires `Authorization: Bearer <access token>` (ADR-002). Stateless (decision L3): it checks
 * the signature and expiry only, so a token of a revoked session keeps working until it expires,
 * at most JWT_ACCESS_EXPIRATION. Any failure is a generic 401.
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(@Inject(ACCESS_TOKEN_VERIFIER) private readonly verifier: AccessTokenVerifier) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<GuardedRequest>();
    const match = /^Bearer\s+(\S+)$/i.exec(request.headers.authorization ?? '');
    const verified = match ? await this.verifier.verify(match[1]!) : null;
    if (!verified) {
      throw new UnauthorizedException();
    }
    request[AUTHENTICATED_USER] = verified;
    return true;
  }
}

/** Who the access token of a request guarded by AccessTokenGuard authenticates. */
export function authenticatedUserOf(request: object): VerifiedAccessToken {
  const user = (request as GuardedRequest)[AUTHENTICATED_USER];
  if (!user) {
    throw new Error('authenticatedUserOf used on a request not guarded by AccessTokenGuard');
  }
  return user;
}
