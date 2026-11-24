import { Animal } from '../../domain/entities/animal.entity';
import type { AnimalRepository } from '../../domain/ports/animal-repository';
import type { Clock, IdGenerator } from '../../domain/ports/clock-and-ids';
import type { RegisterAnimalCommand } from '../commands/register-animal.command';

/** SCRUM-10: the ADMIN registers an animal; authorization is enforced by the HTTP guard. */
export class RegisterAnimalUseCase {
  constructor(
    private readonly animals: AnimalRepository,
    private readonly clock: Clock,
    private readonly ids: IdGenerator,
    /** The single MVP shelter (Domain Model — Shelter). */
    private readonly shelterId: string,
  ) {}

  async execute(command: RegisterAnimalCommand): Promise<Animal> {
    const animal = Animal.register({
      ...command,
      id: this.ids.next(),
      shelterId: this.shelterId,
      now: this.clock.now(),
    });
    await this.animals.save(animal);
    return animal;
  }
}
