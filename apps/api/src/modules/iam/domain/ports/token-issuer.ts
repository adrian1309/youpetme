import type { Role } from '../value-objects/account-states';

export interface TokenIssuer {
  issueAccessToken(claims: { userId: string; sessionId: string; role: Role }): Promise<string>;
  issueRefreshToken(claims: { userId: string; sessionId: string }): Promise<string>;
}
