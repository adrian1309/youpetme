import type { SessionStatus } from '../value-objects/account-states';

export interface CreateUserSessionProps {
  id: string;
  userId: string;
  refreshTokenHash: string;
  now: Date;
  expiresAt: Date;
}

export interface UserSessionSnapshot {
  id: string;
  userId: string;
  refreshTokenHash: string;
  status: SessionStatus;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * One revocable session, bound to its current refresh token (ADR-002, Domain Model).
 * ACTIVE → REVOKED (rotated token reused, and later logout or password change) and
 * ACTIVE → EXPIRED (a refresh arrives after expiresAt). Both are final. Immutable: every
 * transition returns a new instance.
 */
export class UserSession {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly refreshTokenHash: string,
    readonly status: SessionStatus,
    readonly expiresAt: Date,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static create(props: CreateUserSessionProps): UserSession {
    return new UserSession(
      props.id,
      props.userId,
      props.refreshTokenHash,
      'ACTIVE',
      props.expiresAt,
      props.now,
      props.now,
    );
  }

  static reconstitute(snapshot: UserSessionSnapshot): UserSession {
    return new UserSession(
      snapshot.id,
      snapshot.userId,
      snapshot.refreshTokenHash,
      snapshot.status,
      snapshot.expiresAt,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  isActive(): boolean {
    return this.status === 'ACTIVE';
  }

  isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }

  /** Whether `refreshTokenHash` is the digest of the session's current refresh token. */
  matches(refreshTokenHash: string): boolean {
    return this.refreshTokenHash === refreshTokenHash;
  }

  /** Sliding expiry: each rotation starts a new lifetime (ADR-002, "7 days since last use"). */
  rotate(refreshTokenHash: string, now: Date, expiresAt: Date): UserSession {
    return this.with({ refreshTokenHash, expiresAt, updatedAt: now });
  }

  revoke(now: Date): UserSession {
    return this.with({ status: 'REVOKED', updatedAt: now });
  }

  expire(now: Date): UserSession {
    return this.with({ status: 'EXPIRED', updatedAt: now });
  }

  private with(changes: Partial<UserSessionSnapshot>): UserSession {
    return UserSession.reconstitute({
      id: this.id,
      userId: this.userId,
      refreshTokenHash: this.refreshTokenHash,
      status: this.status,
      expiresAt: this.expiresAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    });
  }
}
