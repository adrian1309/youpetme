import { randomUUID } from 'node:crypto';

import { Logger, Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { EventEmitter2, EventEmitterModule } from '@nestjs/event-emitter';

import type { AppConfig } from '../../platform/configuration/app-config';
import { APP_CONFIG } from '../../platform/configuration/configuration.tokens';
import { PrismaService } from '../../platform/database/prisma.service';
import { LoginUserUseCase } from './application/use-cases/login-user.use-case';
import { RefreshSessionUseCase } from './application/use-cases/refresh-session.use-case';
import { RegisterUserUseCase } from './application/use-cases/register-user.use-case';
import type { IamConfig } from './domain/ports/iam-config';
import type { AccountRegistrationRepository } from './domain/ports/account-registration-repository';
import type { UserRepository } from './domain/ports/user-repository';
import type { UserSessionRepository } from './domain/ports/user-session-repository';
import { NestEventPublisher } from './infrastructure/events/nest-event-publisher';
import { PrismaAccountRegistrationRepository } from './infrastructure/persistence/prisma/prisma-account-registration.repository';
import { PrismaUserSessionRepository } from './infrastructure/persistence/prisma/prisma-user-session.repository';
import { PrismaUserRepository } from './infrastructure/persistence/prisma/prisma-user.repository';
import { Argon2idPasswordHasher } from './infrastructure/security/argon2id-password-hasher';
import { JwtTokenIssuer } from './infrastructure/security/jwt-token-issuer';
import { Sha256RefreshTokenHasher } from './infrastructure/security/sha256-refresh-token-hasher';
import {
  ACCOUNT_REGISTRATION_REPOSITORY,
  LOGIN_USER_USE_CASE,
  REFRESH_SESSION_USE_CASE,
  REGISTER_USER_USE_CASE,
  USER_REPOSITORY,
  USER_SESSION_REPOSITORY,
} from './iam.tokens';
import { AuthSessionController } from './presentation/http/auth-session.controller';
import { IamExceptionFilter } from './presentation/http/iam-exception.filter';
import { RegisterController } from './presentation/http/register.controller';
import { TermsVersionController } from './presentation/http/terms-version.controller';

@Module({
  imports: [EventEmitterModule.forRoot()],
  controllers: [RegisterController, AuthSessionController, TermsVersionController],
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
      provide: USER_SESSION_REPOSITORY,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => new PrismaUserSessionRepository(prisma),
    },
    // One instance each: the password hasher keeps its dummy hash for unknown-email logins.
    { provide: Argon2idPasswordHasher, useFactory: () => new Argon2idPasswordHasher() },
    {
      provide: JwtTokenIssuer,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => new JwtTokenIssuer(config.auth),
    },
    {
      provide: NestEventPublisher,
      inject: [EventEmitter2],
      useFactory: (emitter: EventEmitter2) =>
        new NestEventPublisher(emitter, new Logger('DomainEvents')),
    },
    {
      provide: LOGIN_USER_USE_CASE,
      inject: [
        USER_REPOSITORY,
        USER_SESSION_REPOSITORY,
        Argon2idPasswordHasher,
        JwtTokenIssuer,
        NestEventPublisher,
        APP_CONFIG,
      ],
      useFactory: (
        users: UserRepository,
        sessions: UserSessionRepository,
        passwordHasher: Argon2idPasswordHasher,
        tokens: JwtTokenIssuer,
        events: NestEventPublisher,
        config: AppConfig,
      ) =>
        new LoginUserUseCase(
          users,
          sessions,
          passwordHasher,
          new Sha256RefreshTokenHasher(),
          tokens,
          events,
          { now: () => new Date() },
          { next: () => randomUUID() },
          iamConfig(config),
        ),
    },
    {
      provide: REFRESH_SESSION_USE_CASE,
      inject: [USER_SESSION_REPOSITORY, USER_REPOSITORY, JwtTokenIssuer, APP_CONFIG],
      useFactory: (
        sessions: UserSessionRepository,
        users: UserRepository,
        tokens: JwtTokenIssuer,
        config: AppConfig,
      ) =>
        new RefreshSessionUseCase(
          tokens,
          sessions,
          users,
          new Sha256RefreshTokenHasher(),
          tokens,
          { now: () => new Date() },
          iamConfig(config),
        ),
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
          iamConfig(config),
        ),
    },
  ],
})
export class IamModule {}

function iamConfig(config: AppConfig): IamConfig {
  return { termsVersion: config.termsVersion, refreshTokenTtlMs: config.auth.refreshTtlMs };
}
