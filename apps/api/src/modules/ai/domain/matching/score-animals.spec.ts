import { Animal, type AnimalProps } from '../../../animals/domain/entities/animal.entity';
import { MATCH_RESULTS_MAX, scoreAnimals } from './score-animals';

const NOW = new Date('2026-11-26T10:00:00.000Z');
let sequence = 0;

function animal(overrides: Partial<AnimalProps> = {}): Animal {
  sequence += 1;
  return Animal.reconstitute({
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    shelterId: '00000000-0000-4000-8000-000000000001',
    name: `Animal ${sequence}`,
    species: 'DOG',
    size: 'MEDIUM',
    ageGroup: 'ADULT',
    breed: null,
    temperament: [],
    compatibleWithChildren: null,
    compatibleWithOtherAnimals: null,
    careNotes: null,
    photoUrls: ['https://images.example.com/a.jpg'],
    status: 'AVAILABLE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

const names = (results: ReturnType<typeof scoreAnimals>) => results.map((r) => r.animal.name);

describe('scoreAnimals (ADR-010 mapping)', () => {
  it('scores +1 per stated preference the animal matches, with its reason', () => {
    const dog = animal({ name: 'Toby', size: 'SMALL', ageGroup: 'PUPPY_KITTEN' });

    const [result] = scoreAnimals(
      { preferredSpecies: 'DOG', preferredSize: 'SMALL', preferredAgeGroup: 'PUPPY_KITTEN' },
      [dog],
    );

    expect(result).toEqual({
      animal: dog,
      score: 3,
      reasons: ['SPECIES_MATCH', 'SIZE_MATCH', 'AGE_MATCH'],
    });
  });

  it('hard-filters the stated species, size and age group', () => {
    const results = scoreAnimals(
      { preferredSpecies: 'DOG', preferredSize: 'SMALL', preferredAgeGroup: 'ADULT' },
      [
        animal({ name: 'Cat', species: 'CAT', size: 'SMALL' }),
        animal({ name: 'Big', size: 'LARGE' }),
        animal({ name: 'Senior', size: 'SMALL', ageGroup: 'SENIOR' }),
        animal({ name: 'Fit', size: 'SMALL' }),
      ],
    );

    expect(names(results)).toEqual(['Fit']);
  });

  it('excludes LARGE animals for SMALL housing and scores size by closeness to the home', () => {
    const results = scoreAnimals({ housingSize: 'SMALL' }, [
      animal({ name: 'Large', size: 'LARGE' }),
      animal({ name: 'Medium', size: 'MEDIUM' }),
      animal({ name: 'Small', size: 'SMALL' }),
    ]);

    expect(results.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Small', 2, ['SIZE_FITS_HOME']],
      ['Medium', 1, ['SIZE_FITS_HOME']],
    ]);
  });

  it('keeps every size for LARGE housing, ranking the closest first', () => {
    const results = scoreAnimals({ housingSize: 'LARGE' }, [
      animal({ name: 'Small', size: 'SMALL' }),
      animal({ name: 'Large', size: 'LARGE' }),
      animal({ name: 'Medium', size: 'MEDIUM' }),
    ]);

    // SMALL is two steps away: score 0, so it is dropped.
    expect(names(results)).toEqual(['Large', 'Medium']);
  });

  it('excludes animals known to be incompatible with children or other animals', () => {
    const results = scoreAnimals({ hasChildren: true, hasOtherAnimals: true }, [
      animal({ name: 'NoKids', compatibleWithChildren: false, compatibleWithOtherAnimals: true }),
      animal({ name: 'NoPets', compatibleWithChildren: true, compatibleWithOtherAnimals: false }),
      animal({ name: 'Both', compatibleWithChildren: true, compatibleWithOtherAnimals: true }),
    ]);

    expect(results.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Both', 4, ['GOOD_WITH_CHILDREN', 'GOOD_WITH_ANIMALS']],
    ]);
  });

  it('keeps an unknown (null) compatibility without excluding or scoring it', () => {
    const results = scoreAnimals({ hasChildren: true, preferredSpecies: 'DOG' }, [
      animal({ name: 'Unknown', compatibleWithChildren: null }),
    ]);

    expect(results.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Unknown', 1, ['SPECIES_MATCH']],
    ]);
  });

  it('scores temperament against activity level', () => {
    const active = scoreAnimals({ activityLevel: 'HIGH' }, [
      animal({ name: 'Calm', temperament: ['CALM'] }),
      animal({ name: 'Playful', temperament: ['PLAYFUL', 'ENERGETIC'] }),
    ]);
    const quiet = scoreAnimals({ activityLevel: 'LOW' }, [
      animal({ name: 'Independent', temperament: ['INDEPENDENT'] }),
      animal({ name: 'Energetic', temperament: ['ENERGETIC'] }),
    ]);

    expect(active.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Playful', 2, ['ACTIVE_MATCH']],
    ]);
    expect(quiet.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Independent', 2, ['CALM_MATCH']],
    ]);
  });

  it('favours affectionate and penalises shy or energetic animals for a first-time adopter', () => {
    const results = scoreAnimals({ experienceWithAnimals: 'NONE', preferredSpecies: 'DOG' }, [
      animal({ name: 'Shy', temperament: ['SHY'] }),
      animal({ name: 'Sweet', temperament: ['AFFECTIONATE'] }),
      animal({ name: 'Mixed', temperament: ['AFFECTIONATE', 'ENERGETIC'] }),
    ]);

    // Shy: 1 - 1 = 0, dropped. Mixed: 1 + 1 - 1 = 1.
    expect(results.map((r) => [r.animal.name, r.score, r.reasons])).toEqual([
      ['Sweet', 2, ['SPECIES_MATCH', 'GOOD_FOR_BEGINNERS']],
      ['Mixed', 1, ['SPECIES_MATCH', 'GOOD_FOR_BEGINNERS']],
    ]);
  });

  it('returns nothing for an empty profile (no animal scores above 0)', () => {
    expect(scoreAnimals({}, [animal(), animal()])).toEqual([]);
  });

  it('returns at most five, best first, keeping catalogue order on ties', () => {
    const catalogue = Array.from({ length: 7 }, (_, index) =>
      animal({ name: `Tie ${index}`, temperament: index === 6 ? ['PLAYFUL'] : [] }),
    );

    const results = scoreAnimals({ preferredSpecies: 'DOG', activityLevel: 'HIGH' }, catalogue);

    expect(MATCH_RESULTS_MAX).toBe(5);
    expect(names(results)).toEqual(['Tie 6', 'Tie 0', 'Tie 1', 'Tie 2', 'Tie 3']);
  });
});
