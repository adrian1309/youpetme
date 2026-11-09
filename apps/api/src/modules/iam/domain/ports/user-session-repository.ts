import type { UserSession } from '../entities/user-session.entity';

export interface UserSessionRepository {
  create(session: UserSession): Promise<void>;
  findById(sessionId: string): Promise<UserSession | null>;
  /**
   * Stores the rotated session only if the stored hash is still `expectedHash` and the session is
   * still ACTIVE (compare-and-set). Returns false when another refresh got there first.
   */
  rotate(rotated: UserSession, expectedHash: string): Promise<boolean>;
  /**
   * Persists a REVOKED or EXPIRED transition of a session that is still ACTIVE. Returns false
   * when the session had already ended, so callers can avoid acting on it twice.
   */
  end(session: UserSession): Promise<boolean>;
}
