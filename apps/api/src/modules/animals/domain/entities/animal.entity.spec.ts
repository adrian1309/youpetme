import { AnimalValidationError } from '../errors/animal-validation.error';
import { Animal, type NewAnimalInput } from './animal.entity';

const now = new Date('2026-11-24T10:00:00.000Z');

function input(overrides: Partial<NewAnimalInput> = {}): NewAnimalInput {
  return {
    id: '00000000-0000-4000-8000-0000000000a1',
    shelterId: '00000000-0000-4000-8000-000000000001',
    now,
    name: 'Luna',
    species: 'DOG',
    size: 'MEDIUM',
    ageGroup: 'ADULT',
    photoUrls: ['https://images.example.com/luna.jpg'],
    ...overrides,
  };
}

function issuesOf(overrides: Partial<NewAnimalInput>): { field: string; code: string }[] {
  try {
    Animal.register(input(overrides));
  } catch (error) {
    if (error instanceof AnimalValidationError) return [...error.issues];
    throw error;
  }
  throw new Error('expected a validation error');
}

describe('Animal.register', () => {
  describe('Given valid data (SCRUM-10, scenario 1)', () => {
    it('creates an AVAILABLE animal in the given shelter, with trimmed text and unknown flags as null', () => {
      const animal = Animal.register(
        input({ name: '  Luna  ', breed: '  ', careNotes: ' Needs a garden ' }),
      );

      expect(animal).toMatchObject({
        id: '00000000-0000-4000-8000-0000000000a1',
        shelterId: '00000000-0000-4000-8000-000000000001',
        name: 'Luna',
        species: 'DOG',
        size: 'MEDIUM',
        ageGroup: 'ADULT',
        breed: null,
        temperament: [],
        compatibleWithChildren: null,
        compatibleWithOtherAnimals: null,
        careNotes: 'Needs a garden',
        photoUrls: ['https://images.example.com/luna.jpg'],
        status: 'AVAILABLE',
        createdAt: now,
        updatedAt: now,
      });
    });

    it('keeps the optional temperament tags without duplicates and the compatibility flags', () => {
      const animal = Animal.register(
        input({
          temperament: ['CALM', 'PLAYFUL', 'CALM'],
          compatibleWithChildren: true,
          compatibleWithOtherAnimals: false,
        }),
      );

      expect(animal.temperament).toEqual(['CALM', 'PLAYFUL']);
      expect(animal.compatibleWithChildren).toBe(true);
      expect(animal.compatibleWithOtherAnimals).toBe(false);
    });
  });

  describe('Given missing required fields (scenario 2)', () => {
    it('reports REQUIRED for each missing field', () => {
      expect(issuesOf({ name: ' ', species: '', size: '', ageGroup: '' })).toEqual([
        { field: 'name', code: 'REQUIRED' },
        { field: 'species', code: 'REQUIRED' },
        { field: 'size', code: 'REQUIRED' },
        { field: 'ageGroup', code: 'REQUIRED' },
      ]);
    });
  });

  describe('Given no photo (scenario 3)', () => {
    it('reports REQUIRED on photoUrls', () => {
      expect(issuesOf({ photoUrls: [] })).toEqual([{ field: 'photoUrls', code: 'REQUIRED' }]);
    });
  });

  describe('Given values outside the taxonomy (scenario 4)', () => {
    it('reports INVALID_FORMAT for species, size, ageGroup and temperament', () => {
      expect(
        issuesOf({ species: 'BIRD', size: 'XL', ageGroup: 'BABY', temperament: ['GRUMPY'] }),
      ).toEqual([
        { field: 'species', code: 'INVALID_FORMAT' },
        { field: 'size', code: 'INVALID_FORMAT' },
        { field: 'ageGroup', code: 'INVALID_FORMAT' },
        { field: 'temperament', code: 'INVALID_FORMAT' },
      ]);
    });
  });

  describe('Given invalid photos', () => {
    it('rejects a URL that is not https', () => {
      expect(issuesOf({ photoUrls: ['http://images.example.com/a.jpg'] })).toEqual([
        { field: 'photoUrls', code: 'INVALID_FORMAT' },
      ]);
    });

    it('rejects something that is not a URL', () => {
      expect(issuesOf({ photoUrls: ['not a url'] })).toEqual([
        { field: 'photoUrls', code: 'INVALID_FORMAT' },
      ]);
    });

    it('rejects more than five photos', () => {
      const six = Array.from({ length: 6 }, (_, i) => `https://images.example.com/${i}.jpg`);
      expect(issuesOf({ photoUrls: six })).toEqual([{ field: 'photoUrls', code: 'TOO_LONG' }]);
    });
  });

  describe('Given text over its limit', () => {
    it('reports TOO_LONG for name, breed and careNotes', () => {
      expect(
        issuesOf({
          name: 'a'.repeat(Animal.NAME_MAX_LENGTH + 1),
          breed: 'b'.repeat(Animal.BREED_MAX_LENGTH + 1),
          careNotes: 'c'.repeat(Animal.CARE_NOTES_MAX_LENGTH + 1),
        }),
      ).toEqual([
        { field: 'name', code: 'TOO_LONG' },
        { field: 'breed', code: 'TOO_LONG' },
        { field: 'careNotes', code: 'TOO_LONG' },
      ]);
    });

    it('accepts text exactly at its limit', () => {
      expect(() =>
        Animal.register(input({ name: 'a'.repeat(Animal.NAME_MAX_LENGTH) })),
      ).not.toThrow();
    });
  });
});
