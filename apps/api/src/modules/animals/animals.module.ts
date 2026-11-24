import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';

import { PrismaService } from '../../platform/database/prisma.service';
import { IamModule } from '../iam/iam.module';
import { GetAnimalUseCase } from './application/use-cases/get-animal.use-case';
import { ListAvailableAnimalsUseCase } from './application/use-cases/list-available-animals.use-case';
import { RegisterAnimalUseCase } from './application/use-cases/register-animal.use-case';
import {
  ANIMAL_REPOSITORY,
  GET_ANIMAL_USE_CASE,
  LIST_AVAILABLE_ANIMALS_USE_CASE,
  REGISTER_ANIMAL_USE_CASE,
} from './animals.tokens';
import type { AnimalRepository } from './domain/ports/animal-repository';
import { MVP_SHELTER_ID } from './domain/value-objects/mvp-shelter';
import { PrismaAnimalRepository } from './infrastructure/persistence/prisma/prisma-animal.repository';
import { AdminGuard } from './presentation/http/admin.guard';
import { AnimalsController } from './presentation/http/animals.controller';

@Module({
  // IamModule provides the stateless access-token guard (ADR-002).
  imports: [IamModule],
  controllers: [AnimalsController],
  providers: [
    AdminGuard,
    {
      provide: ANIMAL_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAnimalRepository(prisma),
    },
    {
      provide: REGISTER_ANIMAL_USE_CASE,
      inject: [ANIMAL_REPOSITORY],
      useFactory: (animals: AnimalRepository) =>
        new RegisterAnimalUseCase(
          animals,
          { now: () => new Date() },
          { next: () => randomUUID() },
          MVP_SHELTER_ID,
        ),
    },
    {
      provide: LIST_AVAILABLE_ANIMALS_USE_CASE,
      inject: [ANIMAL_REPOSITORY],
      useFactory: (animals: AnimalRepository) => new ListAvailableAnimalsUseCase(animals),
    },
    {
      provide: GET_ANIMAL_USE_CASE,
      inject: [ANIMAL_REPOSITORY],
      useFactory: (animals: AnimalRepository) => new GetAnimalUseCase(animals),
    },
  ],
})
export class AnimalsModule {}
