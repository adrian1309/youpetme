import {
  ACTIVITY_LEVELS,
  type AdopterProfile,
  AGE_GROUPS,
  EXPERIENCE_LEVELS,
  HOUSING_SIZES,
  SIZES,
  SPECIES,
} from '@youpetme/contracts';
import { z } from 'zod';

/**
 * A guest's latest AI Matching profile (ADR-010): it stays only in the browser until they
 * register and accept saving it (SCRUM-16, scenario 3).
 */
export const MATCHING_PROFILE_KEY = 'youpetme:matching-profile';

const profileSchema = z
  .object({
    housingSize: z.enum(HOUSING_SIZES).optional(),
    activityLevel: z.enum(ACTIVITY_LEVELS).optional(),
    experienceWithAnimals: z.enum(EXPERIENCE_LEVELS).optional(),
    hasChildren: z.boolean().optional(),
    hasOtherAnimals: z.boolean().optional(),
    preferredSpecies: z.enum(SPECIES).optional(),
    preferredSize: z.enum(SIZES).optional(),
    preferredAgeGroup: z.enum(AGE_GROUPS).optional(),
  })
  .strict();

/** The stored profile; null when absent, invalid, empty or storage is unavailable. */
export function readMatchingProfile(): AdopterProfile | null {
  try {
    const stored = window.localStorage.getItem(MATCHING_PROFILE_KEY);
    if (stored === null) return null;
    const parsed = profileSchema.safeParse(JSON.parse(stored));
    return parsed.success && Object.keys(parsed.data).length > 0 ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Ignored when storage is unavailable: the guest just will not be offered it later. */
export function writeMatchingProfile(profile: AdopterProfile): void {
  try {
    window.localStorage.setItem(MATCHING_PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Blocked storage.
  }
}

export function clearMatchingProfile(): void {
  try {
    window.localStorage.removeItem(MATCHING_PROFILE_KEY);
  } catch {
    // Blocked storage.
  }
}
