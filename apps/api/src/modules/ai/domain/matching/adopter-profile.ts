import type { AgeGroup, Size, Species } from '../../../animals/domain/value-objects/taxonomy';

/** Adopter attributes of ADR-010 ("Adopter attributes and mapping"). */
export const HOUSING_SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const ACTIVITY_LEVELS = ['LOW', 'MODERATE', 'HIGH'] as const;
export const EXPERIENCE_LEVELS = ['NONE', 'SOME', 'EXPERIENCED'] as const;

export type HousingSize = (typeof HOUSING_SIZES)[number];
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];
export type ExperienceLevel = (typeof EXPERIENCE_LEVELS)[number];

/**
 * What the adopter said about themselves. Every field is optional: a missing one was not said,
 * so it neither filters nor scores. Never free text.
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
