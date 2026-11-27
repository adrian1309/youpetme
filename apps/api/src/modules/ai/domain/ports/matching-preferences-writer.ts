import type { AdopterProfile } from '../matching/adopter-profile';

/** Saves a signed-in user's latest adopter profile (UserProfile.matchingPreferences, ADR-010). */
export interface MatchingPreferencesWriter {
  /** Replaces the previous profile. */
  save(userId: string, profile: AdopterProfile): Promise<void>;
}
