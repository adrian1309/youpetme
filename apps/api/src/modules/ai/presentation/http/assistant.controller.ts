import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Post,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  ASSISTANT_HISTORY_MAX_MESSAGES,
  ASSISTANT_MESSAGE_MAX_LENGTH,
  ASSISTANT_REPLY_MAX_LENGTH,
  type AssistantMessageResponse,
} from '@youpetme/contracts';

import {
  OptionalAccessTokenGuard,
  optionalAuthenticatedUserOf,
} from '../../../iam/presentation/http/access-token.guard';
import { SEND_ASSISTANT_MESSAGE_USE_CASE } from '../../ai.tokens';
import type { SendAssistantMessageUseCase } from '../../application/use-cases/send-assistant-message.use-case';
import { AssistantExceptionFilter } from './assistant-exception.filter';
import { AssistantRateLimitGuard } from './assistant-rate-limit.guard';
import { parseAssistantRequest } from './assistant.request';

/**
 * Diango's chat (ADR-011, SCRUM-18). Public: visitors and signed-in users. Bearer is optional
 * and no refresh cookie is involved, so TrustedBrowserRequestGuard does not apply.
 */
@ApiTags('assistant')
@ApiBearerAuth()
@Controller('assistant')
// Rate limit first: a flood is rejected before any token check or model call.
@UseGuards(AssistantRateLimitGuard, OptionalAccessTokenGuard)
@UseFilters(AssistantExceptionFilter)
export class AssistantController {
  constructor(
    @Inject(SEND_ASSISTANT_MESSAGE_USE_CASE)
    private readonly sendMessage: SendAssistantMessageUseCase,
  ) {}

  @Post('messages')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Ask Diango; the client resends the session history (nothing is stored)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['messages'],
      properties: {
        messages: {
          type: 'array',
          minItems: 1,
          maxItems: ASSISTANT_HISTORY_MAX_MESSAGES,
          description: `Oldest first; the last one is the user's (max ${ASSISTANT_MESSAGE_MAX_LENGTH} characters; earlier assistant replies max ${ASSISTANT_REPLY_MAX_LENGTH}).`,
          items: {
            type: 'object',
            required: ['role', 'content'],
            properties: {
              role: { type: 'string', enum: ['user', 'assistant'] },
              content: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: '{ reply } in plain text' })
  @ApiResponse({ status: 400, description: 'Invalid body (ADR-017 details)' })
  @ApiResponse({ status: 401, description: 'A Bearer token was sent but is invalid or expired' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP; see Retry-After' })
  @ApiResponse({ status: 503, description: 'The AI provider failed or timed out' })
  async messages(@Body() body: unknown, @Req() request: object): Promise<AssistantMessageResponse> {
    const messages = parseAssistantRequest(body);
    const user = optionalAuthenticatedUserOf(request);
    return this.sendMessage.execute({ userId: user?.userId ?? null, messages });
  }
}
