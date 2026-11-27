import {
  AGE_GROUPS,
  ANIMAL_BREED_MAX_LENGTH,
  ANIMAL_CARE_NOTES_MAX_LENGTH,
  ANIMAL_NAME_MAX_LENGTH,
  type CreateAnimalRequest,
  SIZES,
  SPECIES,
  type Temperament,
} from '@youpetme/contracts';
import { z } from 'zod';

/** Error messages are translation keys; the API stays the source of truth (it re-validates). */
const err = (key: string) => `animals.register.errors.${key}`;

const choice = (values: readonly string[]) =>
  z.string().refine((value) => values.includes(value), { message: err('choose') });

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { message: err('tooLong') });

export function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export const registerAnimalSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: err('required') })
    .max(ANIMAL_NAME_MAX_LENGTH, { message: err('tooLong') }),
  species: choice(SPECIES),
  size: choice(SIZES),
  ageGroup: choice(AGE_GROUPS),
  photoUrl: z
    .string()
    .trim()
    .min(1, { message: err('required') })
    .refine(isHttpsUrl, { message: err('photoUrl') }),
  breed: optionalText(ANIMAL_BREED_MAX_LENGTH),
  temperament: z.array(z.string()),
  compatibleWithChildren: z.enum(['unknown', 'yes', 'no']),
  compatibleWithOtherAnimals: z.enum(['unknown', 'yes', 'no']),
  careNotes: optionalText(ANIMAL_CARE_NOTES_MAX_LENGTH),
});

export type RegisterAnimalFormValues = z.input<typeof registerAnimalSchema>;

export const REGISTER_ANIMAL_DEFAULTS: RegisterAnimalFormValues = {
  name: '',
  species: '',
  size: '',
  ageGroup: '',
  photoUrl: '',
  breed: '',
  temperament: [],
  compatibleWithChildren: 'unknown',
  compatibleWithOtherAnimals: 'unknown',
  careNotes: '',
};

const flag = (value: 'unknown' | 'yes' | 'no') => (value === 'unknown' ? null : value === 'yes');

/** MVP: one photo per animal in the form; the API accepts up to five. */
export function toCreateAnimalRequest(values: RegisterAnimalFormValues): CreateAnimalRequest {
  const parsed = registerAnimalSchema.parse(values);
  return {
    name: parsed.name,
    species: parsed.species as CreateAnimalRequest['species'],
    size: parsed.size as CreateAnimalRequest['size'],
    ageGroup: parsed.ageGroup as CreateAnimalRequest['ageGroup'],
    photoUrls: [parsed.photoUrl],
    breed: parsed.breed || null,
    temperament: parsed.temperament as Temperament[],
    compatibleWithChildren: flag(parsed.compatibleWithChildren),
    compatibleWithOtherAnimals: flag(parsed.compatibleWithOtherAnimals),
    careNotes: parsed.careNotes || null,
  };
}

export const FIELD_LIMITS = {
  name: ANIMAL_NAME_MAX_LENGTH,
  breed: ANIMAL_BREED_MAX_LENGTH,
  careNotes: ANIMAL_CARE_NOTES_MAX_LENGTH,
} as const;
