import { SessionOwnershipMismatchError } from '../../domain/errors/session-ownership-mismatch.error';
import { SessionRevoked } from '../../domain/events/session-revoked.event';
import type { Clock } from '../../domain/ports/clock';
import type { EventPublisher } from '../../domain/ports/event-publisher';
import type { RefreshTokenVerifier } from '../../domain/ports/refresh-token-verifier';
import type { UserSessionRepository } from '../../domain/ports/user-session-repository';
import type { RevokeSessionCommand } from '../commands/revoke-session.command';

/**
 * TS-IAM-003 logout: revokes only the session named by the refresh cookie (US-IAM-003, scenario
 * 2), and only when it belongs to the user of the access token (L1). It is idempotent (L2): with
 * no usable cookie, or a session that already ended, there is nothing to revoke and no error.
 */
export class RevokeSessionUseCase {
  constructor(
    private readonly verifier: RefreshTokenVerifier,
    private readonly sessions: UserSessionRepository,
    private readonly events: EventPublisher,
    private readonly clock: Clock,
  ) {}

  async execute(command: RevokeSessionCommand): Promise<void> {
    if (!command.refreshToken) return;
    const claims = await this.verifier.verify(command.refreshToken);
    // An expired token cannot renew its session any more: nothing left to close.
    if (!claims || claims.expired) return;

    const session = await this.sessions.findById(claims.sessionId);
    if (!session) return;
    if (session.userId !== command.userId || claims.userId !== command.userId) {
      throw new SessionOwnershipMismatchError();
    }
    if (!session.isActive()) return;

    const now = this.clock.now();
    // ADR-016: only once the revocation is stored, and only if this call made it.
    if (await this.sessions.end(session.revoke(now))) {
      await this.events.publish(new SessionRevoked(session.id, session.userId, now));
    }
  }
}
