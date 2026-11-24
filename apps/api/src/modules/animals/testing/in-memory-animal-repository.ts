import type { Animal } from '../domain/entities/animal.entity';
import type {
  AnimalFilters,
  AnimalPage,
  AnimalRepository,
} from '../domain/ports/animal-repository';

/** Test-only adapter with the same behaviour as the Prisma one (ARCH-002 — Testing strategy). */
export class InMemoryAnimalRepository implements AnimalRepository {
  readonly animals = new Map<string, Animal>();

  async save(animal: Animal): Promise<void> {
    this.animals.set(animal.id, animal);
  }

  async findById(id: string): Promise<Animal | null> {
    return this.animals.get(id) ?? null;
  }

  async listAvailable(
    filters: AnimalFilters,
    page: { offset: number; limit: number },
  ): Promise<AnimalPage> {
    const matching = [...this.animals.values()]
      .filter((animal) => animal.status === 'AVAILABLE')
      .filter((animal) =>
        (Object.keys(filters) as (keyof AnimalFilters)[]).every(
          (key) => filters[key] === undefined || animal[key] === filters[key],
        ),
      )
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return {
      items: matching.slice(page.offset, page.offset + page.limit),
      total: matching.length,
    };
  }
}
