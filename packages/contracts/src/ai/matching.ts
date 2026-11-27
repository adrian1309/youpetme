/** AI Matching (ADR-010, SCRUM-16): free text in, up to five AVAILABLE animals out. */
import type { AgeGroup, AnimalSummary, Size, Species } from '../animals/animals';

/** Longest description a user can send. */
export const MATCHING_DESCRIPTION_MAX_LENGTH = 1000;
/** Most animals one matching run returns. */
export const MATCHING_RESULTS_MAX = 5;

/** Adopter attributes of ADR-010 ("Adopter attributes and mapping"). */
export const HOUSING_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const ACTIVITY_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;
export const EXPERIENCE_LEVELS = ['NONE', 'SOME', 'EXPERIENCED'] as const;

export type HousingSize = (typeof HOUSING_SIZES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * The adopter profile extracted from the description. Every field is optional: a missing one
 * means the user did not say it (no constraint). Also the shape of UserProfile.matchingPreferences.
 */
export interface AdopterProfile {
  housingSize?: HousingSize;
  activityLevel?: ActivityLevel;
  experienceWithAnimals?: ExperienceLevel;
  hasChildren?: boolean;
  hasOtherAnimals?: boolean;
  preferredSpecies?: Species;
  preferredSize?: Size;
  preferredAgeGroup?: AgeGroup;
}

/** Why an animal fits; the client shows its own text for each code. */
export const MATCH_REASONS = [
  'SPECIES_MATCH',
  'SIZE_MATCH',
  'AGE_MATCH',
  'SIZE_FITS_HOME',
  'ACTIVE_MATCH',
  'CALM_MATCH',
  'GOOD_FOR_BEGINNERS',
  'GOOD_WITH_CHILDREN',
  'GOOD_WITH_ANIMALS',
] as const;

export type MatchReason = (typeof MATCH_REASONS)[number];

/** POST /api/v1/matching. */
export interface MatchingRequest {
  /** Free text, 1 to MATCHING_DESCRIPTION_MAX_LENGTH characters. */
  description: string;
}

export interface MatchResult {
  animal: AnimalSummary;
  /** Positive integer; higher fits better. */
  score: number;
  reasons: MatchReason[];
}

export interface MatchingResponse {
  profile: AdopterProfile;
  /** Best first; empty when nothing fits (not an error). */
  results: MatchResult[];
}

/** PUT /api/v1/users/me/matching-preferences body (scenario 3: a guest's profile after registering). */
export type SaveMatchingPreferencesRequest = AdopterProfile;
