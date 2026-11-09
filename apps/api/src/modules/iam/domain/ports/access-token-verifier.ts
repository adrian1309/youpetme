import type { Role } from '../value-objects/account-states';

export interface VerifiedAccessToken {
  userId: string;
  sessionId: string;
  role: Role;
}

/**
 * Checks an access token's signature and expiry and reads its claims; null when it is not a
 * valid, current access token. Stateless (ADR-002, L3): the session is not looked up.
 */
export interface AccessTokenVerifier {
  verify(accessToken: string): Promise<VerifiedAccessToken | null>;
}
