import type { PasswordResetToken } from '../entities/password-reset-token.entity';

export interface CompletePasswordReset {
  /** The token already marked USED. */
  token: PasswordResetToken;
  /** Argon2id hash of the new password. */
  passwordHash: string;
}

export interface PasswordResetTokenRepository {
  findByHash(tokenHash: string): Promise<PasswordResetToken | null>;
  /** When the user's most recent token was issued, whatever its status; null if never. */
  latestIssuedAt(userId: string): Promise<Date | null>;
  /**
   * Stores a new ACTIVE token and, in the same transaction, marks every other ACTIVE token of
   * the user SUPERSEDED: only the latest link works.
   */
  issue(token: PasswordResetToken): Promise<void>;
  /** Persists the ACTIVE → EXPIRED transition; does nothing if the token already left ACTIVE. */
  expire(token: PasswordResetToken): Promise<void>;
  /**
   * In one transaction: consumes the token only if it is still ACTIVE (compare-and-set), stores
   * the new password hash, supersedes the user's other ACTIVE tokens and revokes every ACTIVE
   * session of the user (ADR-002, Password Changes). Returns false, changing nothing, when the
   * token was no longer ACTIVE, so two simultaneous confirmations cannot both succeed.
   */
  completeReset(reset: CompletePasswordReset): Promise<boolean>;
}
