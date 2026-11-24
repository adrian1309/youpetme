import {
  startTestDatabase,
  type TestDatabase,
} from '../../../../../platform/database/testing/test-database';
import { Animal, type AnimalProps } from '../../../domain/entities/animal.entity';
import { MVP_SHELTER_ID } from '../../../domain/value-objects/mvp-shelter';
import { PrismaAnimalRepository } from './prisma-animal.repository';

const BASE = new Date('2026-11-24T10:00:00.000Z');
const ALL = { offset: 0, limit: 50 };
let sequence = 0;

function animal(overrides: Partial<AnimalProps> = {}): Animal {
  sequence += 1;
  return Animal.reconstitute({
    id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
    shelterId: MVP_SHELTER_ID,
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
    createdAt: new Date(BASE.getTime() + sequence * 1000),
    updatedAt: new Date(BASE.getTime() + sequence * 1000),
    ...overrides,
  });
}

describe('PrismaAnimalRepository (PostgreSQL)', () => {
  let db: TestDatabase;
  let animals: PrismaAnimalRepository;

  async function saveAll(...list: Animal[]): Promise<string[]> {
    for (const item of list) await animals.save(item);
    return list.map((item) => item.id);
  }

  async function namesFor(filters: Parameters<PrismaAnimalRepository['listAvailable']>[0]) {
    const page = await animals.listAvailable(filters, ALL);
    return page.items.map((item) => item.name).sort();
  }

  beforeAll(async () => {
    db = await startTestDatabase();
    animals = new PrismaAnimalRepository(db.prisma);
  });

  beforeEach(async () => {
    await db.reset();
  });

  afterAll(async () => {
    await db.stop();
  });

  it('has the single MVP shelter "YouPetMe" created by the migration', async () => {
    const shelters = await db.prisma.shelter.findMany();
    expect(shelters.map(({ id, name }) => ({ id, name }))).toEqual([
      { id: MVP_SHELTER_ID, name: 'YouPetMe' },
    ]);
  });

  it('saves an animal and reads every field back', async () => {
    const original = animal({
      breed: 'Labrador',
      temperament: ['CALM', 'AFFECTIONATE'],
      compatibleWithChildren: true,
      compatibleWithOtherAnimals: false,
      careNotes: 'Needs a garden',
      photoUrls: ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg'],
    });
    await animals.save(original);

    const found = await animals.findById(original.id);

    expect(found).toEqual(original);
  });

  it('returns null for an unknown id', async () => {
    expect(await animals.findById('00000000-0000-4000-8000-0000000000ff')).toBeNull();
  });

  it('lists only AVAILABLE animals, newest first (SCRUM-12, scenarios 1 and 4)', async () => {
    await saveAll(
      animal({ name: 'Old' }),
      animal({ name: 'Reserved', status: 'RESERVED' }),
      animal({ name: 'Adopted', status: 'ADOPTED' }),
      animal({ name: 'New' }),
    );

    const page = await animals.listAvailable({}, ALL);

    expect(page.items.map((item) => item.name)).toEqual(['New', 'Old']);
    expect(page.total).toBe(2);
  });

  describe('filters (scenario 2)', () => {
    beforeEach(async () => {
      await saveAll(
        animal({
          name: 'Dog',
          species: 'DOG',
          size: 'LARGE',
          ageGroup: 'SENIOR',
          compatibleWithChildren: true,
          compatibleWithOtherAnimals: false,
        }),
        animal({
          name: 'Cat',
          species: 'CAT',
          size: 'SMALL',
          ageGroup: 'PUPPY_KITTEN',
          compatibleWithChildren: false,
          compatibleWithOtherAnimals: true,
        }),
        animal({ name: 'Unknown', species: 'OTHER', size: 'MEDIUM', ageGroup: 'YOUNG' }),
        animal({ name: 'Reserved cat', species: 'CAT', status: 'RESERVED' }),
      );
    });

    it('filters by species', async () => {
      expect(await namesFor({ species: 'CAT' })).toEqual(['Cat']);
    });

    it('filters by size', async () => {
      expect(await namesFor({ size: 'LARGE' })).toEqual(['Dog']);
    });

    it('filters by ageGroup', async () => {
      expect(await namesFor({ ageGroup: 'YOUNG' })).toEqual(['Unknown']);
    });

    it('filters by compatibleWithChildren; an unknown flag does not match', async () => {
      expect(await namesFor({ compatibleWithChildren: true })).toEqual(['Dog']);
      expect(await namesFor({ compatibleWithChildren: false })).toEqual(['Cat']);
    });

    it('filters by compatibleWithOtherAnimals; an unknown flag does not match', async () => {
      expect(await namesFor({ compatibleWithOtherAnimals: true })).toEqual(['Cat']);
      expect(await namesFor({ compatibleWithOtherAnimals: false })).toEqual(['Dog']);
    });

    it('combines filters with AND, and returns an empty page when nothing matches (scenario 3)', async () => {
      expect(await namesFor({ species: 'DOG', size: 'LARGE' })).toEqual(['Dog']);
      const page = await animals.listAvailable({ species: 'DOG', size: 'SMALL' }, ALL);
      expect(page).toEqual({ items: [], total: 0 });
    });
  });

  it('paginates with offset and limit, reporting the total of every page', async () => {
    await saveAll(animal({ name: 'A' }), animal({ name: 'B' }), animal({ name: 'C' }));

    const page = await animals.listAvailable({}, { offset: 1, limit: 1 });

    expect(page.items.map((item) => item.name)).toEqual(['B']);
    expect(page.total).toBe(3);
  });

  it('rejects an animal without photos at the database level too', async () => {
    await expect(animals.save(animal({ photoUrls: [] }))).rejects.toThrow();
  });
});
