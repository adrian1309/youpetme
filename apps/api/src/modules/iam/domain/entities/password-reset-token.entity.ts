import type { PasswordResetTokenStatus } from '../value-objects/account-states';

export interface IssuePasswordResetTokenProps {
  id: string;
  userId: string;
  tokenHash: string;
  now: Date;
  ttlMs: number;
}

export interface PasswordResetTokenSnapshot {
  id: string;
  userId: string;
  tokenHash: string;
  status: PasswordResetTokenStatus;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Single-use, time-limited credential for resetting a forgotten password (TS-IAM-004, Domain
 * Model). Only the hash of the emailed token is kept. ACTIVE → USED (reset completed),
 * ACTIVE → EXPIRED (used after its lifetime) and ACTIVE → SUPERSEDED (a newer link was requested,
 * or another link completed the reset). All three are final. Immutable.
 */
export class PasswordResetToken {
  private constructor(
    readonly id: string,
    readonly userId: string,
    readonly tokenHash: string,
    readonly status: PasswordResetTokenStatus,
    readonly expiresAt: Date,
    readonly usedAt: Date | null,
    readonly createdAt: Date,
    readonly updatedAt: Date,
  ) {}

  static issue(props: IssuePasswordResetTokenProps): PasswordResetToken {
    return new PasswordResetToken(
      props.id,
      props.userId,
      props.tokenHash,
      'ACTIVE',
      new Date(props.now.getTime() + props.ttlMs),
      null,
      props.now,
      props.now,
    );
  }

  static reconstitute(snapshot: PasswordResetTokenSnapshot): PasswordResetToken {
    return new PasswordResetToken(
      snapshot.id,
      snapshot.userId,
      snapshot.tokenHash,
      snapshot.status,
      snapshot.expiresAt,
      snapshot.usedAt,
      snapshot.createdAt,
      snapshot.updatedAt,
    );
  }

  isExpiredAt(now: Date): boolean {
    return now.getTime() >= this.expiresAt.getTime();
  }

  isUsableAt(now: Date): boolean {
    return this.status === 'ACTIVE' && !this.isExpiredAt(now);
  }

  markUsed(now: Date): PasswordResetToken {
    return this.with({ status: 'USED', usedAt: now, updatedAt: now });
  }

  expire(now: Date): PasswordResetToken {
    return this.with({ status: 'EXPIRED', updatedAt: now });
  }

  private with(changes: Partial<PasswordResetTokenSnapshot>): PasswordResetToken {
    return PasswordResetToken.reconstitute({
      id: this.id,
      userId: this.userId,
      tokenHash: this.tokenHash,
      status: this.status,
      expiresAt: this.expiresAt,
      usedAt: this.usedAt,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      ...changes,
    });
  }
}
