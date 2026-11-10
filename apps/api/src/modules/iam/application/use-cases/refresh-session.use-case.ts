import type { UserSession } from '../../domain/entities/user-session.entity';
import { AccountNotAvailableError } from '../../domain/errors/account-not-available.error';
import { SessionNotRenewableError } from '../../domain/errors/session-not-renewable.error';
import type { Clock } from '../../domain/ports/clock';
import type { IamConfig } from '../../domain/ports/iam-config';
import type { RefreshTokenHasher } from '../../domain/ports/refresh-token-hasher';
import type { RefreshTokenVerifier } from '../../domain/ports/refresh-token-verifier';
import type { TokenIssuer } from '../../domain/ports/token-issuer';
import type { UserRepository } from '../../domain/ports/user-repository';
import type { UserSessionRepository } from '../../domain/ports/user-session-repository';
import type { RefreshSessionCommand } from '../commands/refresh-session.command';
import type { AuthenticatedSessionResult } from '../dto/authenticated-session.result';

/**
 * TS-IAM-002 refresh with rotation (ADR-002): a valid current refresh token is exchanged for a new
 * access token and a new refresh token for the same session. A token that was already rotated
 * means it may have been stolen, so the whole session is revoked (Domain Model — UserSession).
 * No domain event: high volume and no business value.
 */
export class RefreshSessionUseCase {
  constructor(
    private readonly verifier: RefreshTokenVerifier,
    private readonly sessions: UserSessionRepository,
    private readonly users: UserRepository,
    private readonly refreshTokenHasher: RefreshTokenHasher,
    private readonly tokenIssuer: TokenIssuer,
    private readonly clock: Clock,
    private readonly config: IamConfig,
  ) {}

  async execute(command: RefreshSessionCommand): Promise<AuthenticatedSessionResult> {
    if (!command.refreshToken) {
      throw new SessionNotRenewableError();
    }
    const claims = await this.verifier.verify(command.refreshToken);
    if (!claims) {
      throw new SessionNotRenewableError();
    }

    const session = await this.sessions.findById(claims.sessionId);
    if (!session || session.userId !== claims.userId || !session.isActive()) {
      throw new SessionNotRenewableError();
    }

    const now = this.clock.now();
    // Past its sliding expiry or its absolute lifetime (SCRUM-54): the session ends here.
    if (
      claims.expired ||
      session.isExpiredAt(now) ||
      session.hasOutlived(now, this.config.sessionMaxAgeMs)
    ) {
      await this.sessions.end(session.expire(now));
      throw new SessionNotRenewableError();
    }

    const presentedHash = this.refreshTokenHasher.hash(command.refreshToken);
    if (!session.matches(presentedHash)) {
      await this.revoke(session, now);
    }

    const account = await this.users.findAccountById(session.userId);
    if (!account) {
      throw new SessionNotRenewableError();
    }
    if (!account.user.canSignIn()) {
      throw new AccountNotAvailableError();
    }

    const { user } = account;
    const refreshToken = await this.tokenIssuer.issueRefreshToken({
      userId: user.id,
      sessionId: session.id,
    });
    const accessToken = await this.tokenIssuer.issueAccessToken({
      userId: user.id,
      sessionId: session.id,
      role: user.role,
    });
    const expiresAt = session.nextExpiry(
      now,
      this.config.refreshTokenTtlMs,
      this.config.sessionMaxAgeMs,
    );
    const rotated = session.rotate(this.refreshTokenHasher.hash(refreshToken), now, expiresAt);

    // Compare-and-set: if another request rotated this token first, this one is a reuse too.
    if (!(await this.sessions.rotate(rotated, presentedHash))) {
      await this.revoke(session, now);
    }

    return {
      user: {
        id: user.id,
        firstName: account.firstName,
        lastName: account.lastName,
        email: user.email,
        status: user.status,
      },
      accessToken,
      refreshToken,
      refreshTokenExpiresAt: expiresAt,
    };
  }

  private async revoke(session: UserSession, now: Date): Promise<never> {
    await this.sessions.end(session.revoke(now));
    throw new SessionNotRenewableError();
  }
}
