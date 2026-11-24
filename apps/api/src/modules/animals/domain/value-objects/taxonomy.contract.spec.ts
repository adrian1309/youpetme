import {
  AGE_GROUPS,
  ANIMAL_BREED_MAX_LENGTH,
  ANIMAL_CARE_NOTES_MAX_LENGTH,
  ANIMAL_NAME_MAX_LENGTH,
  ANIMAL_PHOTOS_MAX,
  ANIMAL_STATUSES,
  SIZES,
  SPECIES,
  TEMPERAMENTS,
} from '@youpetme/contracts';

import { Animal } from '../entities/animal.entity';
import * as taxonomy from './taxonomy';

describe('Animals domain vs. published contract', () => {
  it('publishes exactly the domain taxonomy (Domain Model — Taxonomy)', () => {
    expect([...SPECIES]).toEqual([...taxonomy.SPECIES]);
    expect([...SIZES]).toEqual([...taxonomy.SIZES]);
    expect([...AGE_GROUPS]).toEqual([...taxonomy.AGE_GROUPS]);
    expect([...TEMPERAMENTS]).toEqual([...taxonomy.TEMPERAMENTS]);
    expect([...ANIMAL_STATUSES]).toEqual([...taxonomy.ANIMAL_STATUSES]);
  });

  it('publishes the same field limits the domain enforces', () => {
    expect(ANIMAL_NAME_MAX_LENGTH).toBe(Animal.NAME_MAX_LENGTH);
    expect(ANIMAL_BREED_MAX_LENGTH).toBe(Animal.BREED_MAX_LENGTH);
    expect(ANIMAL_CARE_NOTES_MAX_LENGTH).toBe(Animal.CARE_NOTES_MAX_LENGTH);
    expect(ANIMAL_PHOTOS_MAX).toBe(Animal.PHOTOS_MAX);
  });
});
