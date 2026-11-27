import Anthropic from '@anthropic-ai/sdk';
import type { Logger } from '@nestjs/common';

import { AiProviderUnavailableError } from '../../domain/errors/ai-provider-unavailable.error';
import type {
  AiBlock,
  AiCompletionRequest,
  AiMessage,
  AiProvider,
  AiStopReason,
  AiTurn,
} from '../../domain/ports/ai-provider';

/** Short chat answers; also caps the cost of one call. */
const MAX_TOKENS = 1024;
const TIMEOUT_MS = 20_000;

/** AIProvider over the Anthropic Messages API, called directly (ARCH-002 — no LangChain). */
export class AnthropicAiProvider implements AiProvider {
  private readonly client: Anthropic;
  private readonly model: string;

  constructor(
    options: { apiKey: string; model: string },
    private readonly logger: Pick<Logger, 'warn'>,
  ) {
    this.client = new Anthropic({ apiKey: options.apiKey, timeout: TIMEOUT_MS, maxRetries: 1 });
    this.model = options.model;
  }

  async complete(request: AiCompletionRequest): Promise<AiTurn> {
    let response: Anthropic.Message;
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS,
        // A short chat with one search tool, or one extraction, needs little reasoning.
        output_config: {
          effort: 'low',
          ...(request.outputSchema
            ? { format: { type: 'json_schema', schema: request.outputSchema } }
            : {}),
        },
        system: request.system,
        ...(request.tools.length > 0
          ? {
              tools: request.tools.map((tool) => ({
                name: tool.name,
                description: tool.description,
                input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
              })),
            }
          : {}),
        messages: request.messages.map(toMessageParam),
      });
    } catch (error) {
      // Only the class and status: never the key, the prompt or the user's messages.
      const status = error instanceof Anthropic.APIError ? ` ${String(error.status)}` : '';
      this.logger.warn(`Anthropic call failed: ${(error as Error).constructor.name}${status}`);
      throw new AiProviderUnavailableError({ cause: error });
    }

    return {
      stopReason: toStopReason(response.stop_reason),
      content: response.content.flatMap(toBlock),
      // Sent back unchanged within the tool loop (thinking blocks included).
      providerData: response.content,
    };
  }
}

function toMessageParam(message: AiMessage): Anthropic.MessageParam {
  if (message.role === 'assistant' && message.providerData !== undefined) {
    return { role: 'assistant', content: message.providerData as Anthropic.ContentBlockParam[] };
  }
  return {
    role: message.role,
    content: message.content.map((block): Anthropic.ContentBlockParam => {
      switch (block.type) {
        case 'text':
          return { type: 'text', text: block.text };
        case 'tool_use':
          return { type: 'tool_use', id: block.id, name: block.name, input: block.input };
        case 'tool_result':
          return {
            type: 'tool_result',
            tool_use_id: block.toolUseId,
            content: block.content,
            ...(block.isError ? { is_error: true } : {}),
          };
      }
    }),
  };
}

function toBlock(block: Anthropic.ContentBlock): AiBlock[] {
  if (block.type === 'text') return [{ type: 'text', text: block.text }];
  if (block.type === 'tool_use') {
    return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }];
  }
  return [];
}

function toStopReason(reason: Anthropic.StopReason | null): AiStopReason {
  switch (reason) {
    case 'end_turn':
    case 'tool_use':
    case 'max_tokens':
    case 'refusal':
      return reason;
    default:
      return 'other';
  }
}
