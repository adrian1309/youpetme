import { randomUUID } from 'node:crypto';

import { Logger, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';

import type { AppConfig } from '../../platform/configuration/app-config';
import { APP_CONFIG } from '../../platform/configuration/configuration.tokens';
import { PrismaService } from '../../platform/database/prisma.service';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import type { AccountRegistrationRepository } from './domain/ports/account-registration-repository';
import type { UserRepository } from './domain/ports/user-repository';
import { NestEventPublisher } from './infrastructure/events/nest-event-publisher';
import { PrismaAccountRegistrationRepository } from './infrastructure/persistence/prisma/prisma-account-registration.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma/prisma-user.repository';
import { Argon2idPasswordHasher } from './infrastructure/security/argon2id-password-hasher';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer';
import { Sha256RefreshTokenHasher } from './infrastructure/security/sha256-refresh-token-hasher';
import {
  ACCOUNT_REGISTRATION_REPOSITORY,
  REGISTER_USER_USE_CASE,
  USER_REPOSITORY,
} from './iam.tokens';
import { IamExceptionFilter } from './presentation/http/iam-exception.filter';
import { RegisterController } from './presentation/http/register.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [RegisterController],
  providers: [
    { provide: APP_FILTER, useClass: IamExceptionFilter },
    {
      provide: USER_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaUserRepository(prisma),
    },
    {
      provide: ACCOUNT_REGISTRATION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaAccountRegistrationRepository(prisma),
    },
    {
      provide: REGISTER_USER_USE_CASE,
      inject: [USER_REPOSITORY, ACCOUNT_REGISTRATION_REPOSITORY, APP_CONFIG, EventEmitter2],
      useFactory: (
        users: UserRepository,
        accounts: AccountRegistrationRepository,
        config: AppConfig,
        emitter: EventEmitter2,
      ) =>
        new RegisterUserUseCase(
          users,
          accounts,
          new Argon2idPasswordHasher(),
          new Sha256RefreshTokenHasher(),
          new JwtTokenIssuer(config.auth),
          new NestEventPublisher(emitter, new Logger('DomainEvents')),
          { now: () => new Date() },
          { next: () => randomUUID() },
          { termsVersion: config.termsVersion, refreshTokenTtlMs: config.auth.refreshTtlMs },
        ),
    },
  ],
})
export class IamModule {}
