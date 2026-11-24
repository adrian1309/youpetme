import { Animal, type AnimalProps } from '../../domain/entities/animal.entity';
import { AnimalNotFoundError } from '../../domain/errors/animal-not-found.error';
import { AnimalValidationError } from '../../domain/errors/animal-validation.error';
import { InMemoryAnimalRepository } from '../../testing/in-memory-animal-repository';
import { GetAnimalUseCase } from './get-animal.use-case';
import { ListAvailableAnimalsUseCase } from './list-available-animals.use-case';
import { RegisterAnimalUseCase } from './register-animal.use-case';

const SHELTER_ID = '00000000-0000-4000-8000-000000000001';
const NOW = new Date('2026-11-24T10:00:00.000Z');

function stored(overrides: Partial<AnimalProps> = {}): Animal {
  return Animal.reconstitute({
    id: '00000000-0000-4000-8000-0000000000b1',
    shelterId: SHELTER_ID,
    name: 'Luna',
    species: 'DOG',
    size: 'MEDIUM',
    ageGroup: 'ADULT',
    breed: null,
    temperament: [],
    compatibleWithChildren: null,
    compatibleWithOtherAnimals: null,
    careNotes: null,
    photoUrls: ['https://images.example.com/luna.jpg'],
    status: 'AVAILABLE',
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  });
}

describe('RegisterAnimalUseCase', () => {
  let animals: InMemoryAnimalRepository;
  let useCase: RegisterAnimalUseCase;

  beforeEach(() => {
    animals = new InMemoryAnimalRepository();
    useCase = new RegisterAnimalUseCase(
      animals,
      { now: () => NOW },
      { next: () => '00000000-0000-4000-8000-0000000000c1' },
      SHELTER_ID,
    );
  });

  it('persists a new AVAILABLE animal in the single MVP shelter', async () => {
    const animal = await useCase.execute({
      name: 'Luna',
      species: 'DOG',
      size: 'MEDIUM',
      ageGroup: 'ADULT',
      photoUrls: ['https://images.example.com/luna.jpg'],
    });

    expect(animal).toMatchObject({
      id: '00000000-0000-4000-8000-0000000000c1',
      shelterId: SHELTER_ID,
      status: 'AVAILABLE',
      createdAt: NOW,
    });
    expect(animals.animals.get(animal.id)).toBe(animal);
  });

  it('persists nothing when the data is invalid', async () => {
    await expect(
      useCase.execute({
        name: '',
        species: 'BIRD',
        size: 'SMALL',
        ageGroup: 'ADULT',
        photoUrls: [],
      }),
    ).rejects.toBeInstanceOf(AnimalValidationError);
    expect(animals.animals.size).toBe(0);
  });
});

describe('ListAvailableAnimalsUseCase', () => {
  it('turns page and pageSize into an offset and returns the page with the total', async () => {
    const animals = new InMemoryAnimalRepository();
    for (let i = 1; i <= 5; i += 1) {
      await animals.save(
        stored({
          id: `00000000-0000-4000-8000-00000000000${i}`,
          createdAt: new Date(NOW.getTime() + i * 1000),
        }),
      );
    }

    const result = await new ListAvailableAnimalsUseCase(animals).execute({
      filters: {},
      page: 2,
      pageSize: 2,
    });

    expect(result.total).toBe(5);
    expect(result.page).toBe(2);
    expect(result.pageSize).toBe(2);
    expect(result.items.map((animal) => animal.id)).toEqual([
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
    ]);
  });
});

describe('GetAnimalUseCase', () => {
  it('returns an animal in any status (SCRUM-13, scenario 2)', async () => {
    const animals = new InMemoryAnimalRepository();
    await animals.save(stored({ status: 'RESERVED' }));

    const animal = await new GetAnimalUseCase(animals).execute(
      '00000000-0000-4000-8000-0000000000b1',
    );

    expect(animal.status).toBe('RESERVED');
  });

  it('throws AnimalNotFoundError for an unknown id (scenario 3)', async () => {
    await expect(
      new GetAnimalUseCase(new InMemoryAnimalRepository()).execute(
        '00000000-0000-4000-8000-0000000000ff',
      ),
    ).rejects.toBeInstanceOf(AnimalNotFoundError);
  });
});
