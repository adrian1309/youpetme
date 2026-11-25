import { randomUUID } from 'node:crypto';

import { Module } from '@nestjs/common';

import { PrismaService } from '../../platform/database/prisma.service';
import { AdminGuard } from '../animals/presentation/http/admin.guard';
import { IamModule } from '../iam/iam.module';
import { DecideAdoptionRequestUseCase } from './application/use-cases/decide-adoption-request.use-case';
import { ListAdoptionRequestsUseCase } from './application/use-cases/list-adoption-requests.use-case';
import { SubmitAdoptionRequestUseCase } from './application/use-cases/submit-adoption-request.use-case';
import {
  ADOPTION_REQUEST_REPOSITORY,
  DECIDE_ADOPTION_REQUEST_USE_CASE,
  LIST_ADOPTION_REQUESTS_USE_CASE,
  SUBMIT_ADOPTION_REQUEST_USE_CASE,
} from './adoptions.tokens';
import type { AdoptionRequestRepository } from './domain/ports/adoption-request-repository';
import { PrismaAdoptionRequestRepository } from './infrastructure/persistence/prisma/prisma-adoption-request.repository';
import { AdoptionRequestsController } from './presentation/http/adoption-requests.controller';

const clock = { now: () => new Date() };

@Module({
  // IamModule provides the stateless access-token guard (ADR-002).
  imports: [IamModule],
  controllers: [AdoptionRequestsController],
  providers: [
    AdminGuard,
    {
      provide: ADOPTION_REQUEST_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAdoptionRequestRepository(prisma),
    },
    {
      provide: SUBMIT_ADOPTION_REQUEST_USE_CASE,
      inject: [ADOPTION_REQUEST_REPOSITORY],
      useFactory: (requests: AdoptionRequestRepository) =>
        new SubmitAdoptionRequestUseCase(requests, clock, { next: () => randomUUID() }),
    },
    {
      provide: LIST_ADOPTION_REQUESTS_USE_CASE,
      inject: [ADOPTION_REQUEST_REPOSITORY],
      useFactory: (requests: AdoptionRequestRepository) =>
        new ListAdoptionRequestsUseCase(requests),
    },
    {
      provide: DECIDE_ADOPTION_REQUEST_USE_CASE,
      inject: [ADOPTION_REQUEST_REPOSITORY],
      useFactory: (requests: AdoptionRequestRepository) =>
        new DecideAdoptionRequestUseCase(requests, clock),
    },
  ],
})
export class AdoptionsModule {}
