import type { PrismaService } from '../../../../../platform/database/prisma.service';
import { Animal } from '../../../domain/entities/animal.entity';
import type {
  AnimalFilters,
  AnimalPage,
  AnimalRepository,
} from '../../../domain/ports/animal-repository';

export class PrismaAnimalRepository implements AnimalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(animal: Animal): Promise<void> {
    await this.prisma.animal.create({
      data: {
        id: animal.id,
        shelterId: animal.shelterId,
        name: animal.name,
        species: animal.species,
        size: animal.size,
        ageGroup: animal.ageGroup,
        breed: animal.breed,
        temperament: animal.temperament,
        compatibleWithChildren: animal.compatibleWithChildren,
        compatibleWithOtherAnimals: animal.compatibleWithOtherAnimals,
        careNotes: animal.careNotes,
        photoUrls: animal.photoUrls,
        status: animal.status,
        createdAt: animal.createdAt,
        updatedAt: animal.updatedAt,
      },
    });
  }

  async findById(id: string): Promise<Animal | null> {
    const row = await this.prisma.animal.findUnique({ where: { id } });
    return row ? Animal.reconstitute(row) : null;
  }

  async listAvailable(
    filters: AnimalFilters,
    page: { offset: number; limit: number },
  ): Promise<AnimalPage> {
    // Undefined filters are ignored by Prisma, so only the given ones apply (AND).
    const where = { status: 'AVAILABLE' as const, ...filters };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.animal.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: page.offset,
        take: page.limit,
      }),
      this.prisma.animal.count({ where }),
    ]);
    return { items: rows.map((row) => Animal.reconstitute(row)), total };
  }
}
