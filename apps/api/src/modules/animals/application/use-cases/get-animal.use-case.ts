import type { Animal } from '../../domain/entities/animal.entity';
import { AnimalNotFoundError } from '../../domain/errors/animal-not-found.error';
import type { AnimalRepository } from '../../domain/ports/animal-repository';

/** SCRUM-13: an animal's detail, whatever its status (the client shows if it is not available). */
export class GetAnimalUseCase {
  constructor(private readonly animals: AnimalRepository) {}

  async execute(id: string): Promise<Animal> {
    const animal = await this.animals.findById(id);
    if (!animal) throw new AnimalNotFoundError();
    return animal;
  }
}
