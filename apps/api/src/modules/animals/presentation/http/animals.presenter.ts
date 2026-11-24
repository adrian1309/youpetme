import type { AnimalDetail, AnimalSummary } from '@youpetme/contracts';

import type { Animal } from '../../domain/entities/animal.entity';

export function toAnimalDetail(animal: Animal): AnimalDetail {
  return {
    id: animal.id,
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
    createdAt: animal.createdAt.toISOString(),
  };
}

export function toAnimalSummary(animal: Animal): AnimalSummary {
  return {
    id: animal.id,
    name: animal.name,
    species: animal.species,
    size: animal.size,
    ageGroup: animal.ageGroup,
    temperament: animal.temperament,
    compatibleWithChildren: animal.compatibleWithChildren,
    compatibleWithOtherAnimals: animal.compatibleWithOtherAnimals,
    photoUrl: animal.photoUrls[0]!,
  };
}
