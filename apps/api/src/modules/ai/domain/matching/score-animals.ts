import type { Animal } from '../../../animals/domain/entities/animal.entity';
import { SIZES, type Temperament } from '../../../animals/domain/value-objects/taxonomy';
import type { AdopterProfile } from './adopter-profile';

/** Most animals one matching run returns. */
export const MATCH_RESULTS_MAX = 5;

export type MatchReason =
  | 'SPECIES_MATCH'
  | 'SIZE_MATCH'
  | 'AGE_MATCH'
  | 'SIZE_FITS_HOME'
  | 'ACTIVE_MATCH'
  | 'CALM_MATCH'
  | 'GOOD_FOR_BEGINNERS'
  | 'GOOD_WITH_CHILDREN'
  | 'GOOD_WITH_ANIMALS';

export interface MatchResult {
  animal: Animal;
  score: number;
  reasons: MatchReason[];
}

/**
 * Deterministic matching (ADR-010, "Adopter attributes and mapping"): hard filters exclude an
 * animal, integer weights rank the rest. Each positive rule adds the reason the client explains.
 * Only animals scoring above 0 are kept, best first; ties keep the input (catalogue) order.
 */
export function scoreAnimals(profile: AdopterProfile, animals: readonly Animal[]): MatchResult[] {
  return animals
    .filter((animal) => passesHardFilters(profile, animal))
    .map((animal) => score(profile, animal))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score) // Array.prototype.sort is stable.
    .slice(0, MATCH_RESULTS_MAX);
}

function passesHardFilters(profile: AdopterProfile, animal: Animal): boolean {
  if (profile.preferredSpecies && animal.species !== profile.preferredSpecies) return false;
  if (profile.preferredSize && animal.size !== profile.preferredSize) return false;
  if (profile.preferredAgeGroup && animal.ageGroup !== profile.preferredAgeGroup) return false;
  if (profile.housingSize === 'SMALL' && animal.size === 'LARGE') return false;
  // null (unknown) is kept: only a known incompatibility excludes.
  if (profile.hasChildren === true && animal.compatibleWithChildren === false) return false;
  if (profile.hasOtherAnimals === true && animal.compatibleWithOtherAnimals === false) return false;
  return true;
}

function score(profile: AdopterProfile, animal: Animal): MatchResult {
  let points = 0;
  const reasons: MatchReason[] = [];
  const add = (value: number, reason?: MatchReason) => {
    points += value;
    if (reason) reasons.push(reason);
  };
  const has = (...tags: Temperament[]) => tags.some((tag) => animal.temperament.includes(tag));

  if (profile.preferredSpecies) add(1, 'SPECIES_MATCH');
  if (profile.preferredSize) add(1, 'SIZE_MATCH');
  if (profile.preferredAgeGroup) add(1, 'AGE_MATCH');

  if (profile.housingSize) {
    const distance = Math.abs(SIZES.indexOf(profile.housingSize) - SIZES.indexOf(animal.size));
    if (distance === 0) add(2, 'SIZE_FITS_HOME');
    else if (distance === 1) add(1, 'SIZE_FITS_HOME');
  }

  if (profile.activityLevel === 'HIGH' && has('ENERGETIC', 'PLAYFUL')) add(2, 'ACTIVE_MATCH');
  if (profile.activityLevel === 'LOW' && has('CALM', 'INDEPENDENT')) add(2, 'CALM_MATCH');

  if (profile.experienceWithAnimals === 'NONE') {
    if (has('AFFECTIONATE')) add(1, 'GOOD_FOR_BEGINNERS');
    if (has('SHY', 'ENERGETIC')) add(-1);
  }

  if (profile.hasChildren === true && animal.compatibleWithChildren === true) {
    add(2, 'GOOD_WITH_CHILDREN');
  }
  if (profile.hasOtherAnimals === true && animal.compatibleWithOtherAnimals === true) {
    add(2, 'GOOD_WITH_ANIMALS');
  }

  return { animal, score: points, reasons };
}
