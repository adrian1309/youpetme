import type { User } from '../entities/user.entity';

/** A user together with the profile data an authentication response and Diango need. */
export interface UserAccount {
  user: User;
  firstName: string;
  lastName: string;
  /** Diango's welcome was already shown to this user (ADR-011, SCRUM-17). */
  hasSeenWelcome: boolean;
  /** UserProfile.matchingPreferences (ADR-010); null until AI Matching saves a profile. */
  matchingPreferences: unknown;
}

export interface UserRepository {
  /** `normalizedEmail` is already trimmed and lowercase. */
  existsByEmail(normalizedEmail: string): Promise<boolean>;
  /** `normalizedEmail` is already trimmed and lowercase. */
  findAccountByEmail(normalizedEmail: string): Promise<UserAccount | null>;
  findAccountById(userId: string): Promise<UserAccount | null>;
  /** Idempotent; does nothing for an unknown user. */
  markWelcomeSeen(userId: string): Promise<void>;
  /**
   * Replaces UserProfile.matchingPreferences (ADR-010). The caller has already validated the
   * value; does nothing for an unknown user.
   */
  saveMatchingPreferences(userId: string, preferences: Record<string, unknown>): Promise<void>;
}
