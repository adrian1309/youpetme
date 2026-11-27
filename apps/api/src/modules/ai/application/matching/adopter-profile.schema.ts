import { z } from 'zod';

import { AGE_GROUPS, SIZES, SPECIES } from '../../../animals/domain/value-objects/taxonomy';
import {
  ACTIVITY_LEVELS,
  type AdopterProfile,
  EXPERIENCE_LEVELS,
  HOUSING_SIZES,
} from '../../domain/matching/adopter-profile';

/**
 * The one check of an adopter profile: enums and booleans only, no unknown keys, so it can
 * never carry free text. Used on the model's output, on PUT /users/me/matching-preferences,
 * before saving and before Diango puts it in its prompt.
 */
export const adopterProfileSchema = z
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

/** The profile, or null when the value is not a valid profile. */
export function parseAdopterProfile(value: unknown): AdopterProfile | null {
  const parsed = adopterProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Drops null values (what the model sends for "not said") before validating. */
export function withoutNulls(value: unknown): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return value;
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null));
}

const nullableEnum = (values: readonly string[]) => ({
  anyOf: [{ type: 'string', enum: [...values] }, { type: 'null' }],
});
const nullableBoolean = { anyOf: [{ type: 'boolean' }, { type: 'null' }] };

/**
 * JSON Schema for the model's structured output: every field required but nullable, so the
 * model must answer each one and uses null for anything the user did not say.
 */
export const ADOPTER_PROFILE_OUTPUT_SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: [
    'housingSize',
    'activityLevel',
    'experienceWithAnimals',
    'hasChildren',
    'hasOtherAnimals',
    'preferredSpecies',
    'preferredSize',
    'preferredAgeGroup',
  ],
  properties: {
    housingSize: nullableEnum(HOUSING_SIZES),
    activityLevel: nullableEnum(ACTIVITY_LEVELS),
    experienceWithAnimals: nullableEnum(EXPERIENCE_LEVELS),
    hasChildren: nullableBoolean,
    hasOtherAnimals: nullableBoolean,
    preferredSpecies: nullableEnum(SPECIES),
    preferredSize: nullableEnum(SIZES),
    preferredAgeGroup: nullableEnum(AGE_GROUPS),
  },
};
