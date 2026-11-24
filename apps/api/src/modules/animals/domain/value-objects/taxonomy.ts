/** Fixed MVP taxonomy (Domain Model — Taxonomy). The published contract mirrors these values. */
export const SPECIES = ['DOG', 'CAT', 'OTHER'] as const;
export const SIZES = ['SMALL', 'MEDIUM', 'LARGE'] as const;
export const AGE_GROUPS = ['PUPPY_KITTEN', 'YOUNG', 'ADULT', 'SENIOR'] as const;
export const TEMPERAMENTS = [
  'CALM',
  'PLAYFUL',
  'ENERGETIC',
  'SHY',
  'AFFECTIONATE',
  'INDEPENDENT',
] as const;
export const ANIMAL_STATUSES = ['AVAILABLE', 'RESERVED', 'ADOPTED'] as const;

export type Species = (typeof SPECIES)[number];
export type Size = (typeof SIZES)[number];
export type AgeGroup = (typeof AGE_GROUPS)[number];
export type Temperament = (typeof TEMPERAMENTS)[number];
export type AnimalStatus = (typeof ANIMAL_STATUSES)[number];

export function isOneOf<T extends string>(values: readonly T[], value: string): value is T {
  return (values as readonly string[]).includes(value);
}
