/** Fixed MVP taxonomy (Domain Model — Taxonomy). The API is the source of truth. */
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

/** Field limits (characters, once trimmed) and photo count bounds. */
export const ANIMAL_NAME_MAX_LENGTH = 100;
export const ANIMAL_BREED_MAX_LENGTH = 100;
export const ANIMAL_CARE_NOTES_MAX_LENGTH = 2000;
export const ANIMAL_PHOTO_URL_MAX_LENGTH = 2048;
export const ANIMAL_PHOTOS_MIN = 1;
export const ANIMAL_PHOTOS_MAX = 5;

/** Catalogue page size: default and maximum. */
export const ANIMALS_PAGE_SIZE_DEFAULT = 12;
export const ANIMALS_PAGE_SIZE_MAX = 50;

/**
 * POST /api/v1/animals (ADMIN only). Photos are https URLs of already hosted images (MVP: no
 * upload). The animal is always created AVAILABLE in the single MVP shelter.
 */
export interface CreateAnimalRequest {
  name: string;
  species: Species;
  size: Size;
  ageGroup: AgeGroup;
  photoUrls: string[];
  breed?: string | null;
  temperament?: Temperament[];
  /** null or absent means "unknown", distinct from false. */
  compatibleWithChildren?: boolean | null;
  compatibleWithOtherAnimals?: boolean | null;
  careNotes?: string | null;
}

/** 201 body of POST and 200 body of GET /api/v1/animals/:id. */
export interface AnimalDetail {
  id: string;
  name: string;
  species: Species;
  size: Size;
  ageGroup: AgeGroup;
  breed: string | null;
  temperament: Temperament[];
  compatibleWithChildren: boolean | null;
  compatibleWithOtherAnimals: boolean | null;
  careNotes: string | null;
  photoUrls: string[];
  status: AnimalStatus;
  createdAt: string;
}

/** One card of the catalogue. */
export interface AnimalSummary {
  id: string;
  name: string;
  species: Species;
  size: Size;
  ageGroup: AgeGroup;
  temperament: Temperament[];
  compatibleWithChildren: boolean | null;
  compatibleWithOtherAnimals: boolean | null;
  /** The first photo. */
  photoUrl: string;
}

/**
 * GET /api/v1/animals query (public, AVAILABLE only). Every filter is optional and they combine
 * with AND. The compatibility filters are 'true' or 'false' and match that exact flag value.
 */
export interface ListAnimalsQuery {
  species?: Species;
  size?: Size;
  ageGroup?: AgeGroup;
  compatibleWithChildren?: 'true' | 'false';
  compatibleWithOtherAnimals?: 'true' | 'false';
  page?: number;
  pageSize?: number;
}

/** 200 body of GET /api/v1/animals, newest first. */
export interface ListAnimalsResponse {
  items: AnimalSummary[];
  page: number;
  pageSize: number;
  total: number;
}
