import type { Logger } from '@nestjs/common';

import type { AiProviderConfig } from '../../../platform/configuration/app-config';
import type { AiProvider } from '../domain/ports/ai-provider';
import { AnthropicAiProvider } from './anthropic/anthropic-ai-provider';
import { FakeAiProvider } from './fake/fake-ai-provider';

/** Picks the adapter from AI_PROVIDER; the configuration only allows anthropic in production. */
export function createAiProvider(
  config: AiProviderConfig,
  logger: Pick<Logger, 'warn'>,
): AiProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicAiProvider({ apiKey: config.apiKey, model: config.model }, logger);
    case 'fake':
      return new FakeAiProvider();
  }
}
