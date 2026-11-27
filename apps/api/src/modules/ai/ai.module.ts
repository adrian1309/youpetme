import { Logger, Module } from '@nestjs/common';

import type { AppConfig } from '../../platform/configuration/app-config';
import { APP_CONFIG } from '../../platform/configuration/configuration.tokens';
import { AnimalsModule } from '../animals/animals.module';
import { LIST_AVAILABLE_ANIMALS_USE_CASE } from '../animals/animals.tokens';
import type { ListAvailableAnimalsUseCase } from '../animals/application/use-cases/list-available-animals.use-case';
import type { UserRepository } from '../iam/domain/ports/user-repository';
import { IamModule } from '../iam/iam.module';
import { USER_REPOSITORY } from '../iam/iam.tokens';
import {
  AI_PROVIDER,
  FIND_MATCHES_USE_CASE,
  SAVE_MATCHING_PREFERENCES_USE_CASE,
  SEND_ASSISTANT_MESSAGE_USE_CASE,
} from './ai.tokens';
import { SearchAnimalsTool } from './application/tools/search-animals.tool';
import { FindMatchesUseCase } from './application/use-cases/find-matches.use-case';
import { SaveMatchingPreferencesUseCase } from './application/use-cases/save-matching-preferences.use-case';
import { SendAssistantMessageUseCase } from './application/use-cases/send-assistant-message.use-case';
import type { AiProvider } from './domain/ports/ai-provider';
import { createAiProvider } from './infrastructure/create-ai-provider';
import { IamAssistantUserContext } from './infrastructure/iam/iam-assistant-user-context';
import { IamMatchingPreferencesWriter } from './infrastructure/iam/iam-matching-preferences-writer';
import { AssistantController } from './presentation/http/assistant.controller';
import { AssistantRateLimitGuard } from './presentation/http/assistant-rate-limit.guard';
import { MatchingController } from './presentation/http/matching.controller';
import { MatchingPreferencesController } from './presentation/http/matching-preferences.controller';

/**
 * AI features through one AIProvider: Diango, the assistant (ADR-011), and AI Matching
 * (ADR-010). Both share the per-IP rate limit guard.
 */
@Module({
  imports: [IamModule, AnimalsModule],
  controllers: [AssistantController, MatchingController, MatchingPreferencesController],
  providers: [
    AssistantRateLimitGuard,
    {
      provide: AI_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createAiProvider(config.ai, new Logger('AiProvider')),
    },
    {
      provide: SEND_ASSISTANT_MESSAGE_USE_CASE,
      inject: [AI_PROVIDER, LIST_AVAILABLE_ANIMALS_USE_CASE, USER_REPOSITORY],
      useFactory: (
        ai: AiProvider,
        listAvailable: ListAvailableAnimalsUseCase,
        users: UserRepository,
      ) =>
        new SendAssistantMessageUseCase(
          ai,
          new SearchAnimalsTool(listAvailable),
          new IamAssistantUserContext(users),
        ),
    },
    {
      provide: FIND_MATCHES_USE_CASE,
      inject: [AI_PROVIDER, LIST_AVAILABLE_ANIMALS_USE_CASE, USER_REPOSITORY],
      useFactory: (
        ai: AiProvider,
        listAvailable: ListAvailableAnimalsUseCase,
        users: UserRepository,
      ) => new FindMatchesUseCase(ai, listAvailable, new IamMatchingPreferencesWriter(users)),
    },
    {
      provide: SAVE_MATCHING_PREFERENCES_USE_CASE,
      inject: [USER_REPOSITORY],
      useFactory: (users: UserRepository) =>
        new SaveMatchingPreferencesUseCase(new IamMatchingPreferencesWriter(users)),
    },
  ],
})
export class AiModule {}
