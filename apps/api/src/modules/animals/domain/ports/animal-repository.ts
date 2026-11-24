import type { Animal } from '../entities/animal.entity';
import type { AgeGroup, Size, Species } from '../value-objects/taxonomy';

/** Catalogue filters; every one is optional and they combine with AND. */
export interface AnimalFilters {
  species?: Species;
  size?: Size;
  ageGroup?: AgeGroup;
  /** Matches animals whose flag has exactly this value (unknown/null never matches). */
  compatibleWithChildren?: boolean;
  compatibleWithOtherAnimals?: boolean;
}

export interface AnimalPage {
  items: Animal[];
  total: number;
}

export interface AnimalRepository {
  save(animal: Animal): Promise<void>;
  findById(id: string): Promise<Animal | null>;
  /** AVAILABLE animals only, newest first. */
  listAvailable(
    filters: AnimalFilters,
    page: { offset: number; limit: number },
  ): Promise<AnimalPage>;
}
