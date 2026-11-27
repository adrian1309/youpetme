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
import { MATCHING_DESCRIPTION_MAX_LENGTH, type MatchingResponse } from '@youpetme/contracts';

import { toAnimalSummary } from '../../../animals/presentation/http/animals.presenter';
import {
  OptionalAccessTokenGuard,
  optionalAuthenticatedUserOf,
} from '../../../iam/presentation/http/access-token.guard';
import { FIND_MATCHES_USE_CASE } from '../../ai.tokens';
import type { FindMatchesUseCase } from '../../application/use-cases/find-matches.use-case';
import { AssistantExceptionFilter } from './assistant-exception.filter';
import { AssistantRateLimitGuard } from './assistant-rate-limit.guard';
import { parseMatchingRequest } from './matching.request';

/**
 * AI Matching (ADR-010, SCRUM-16). Public: visitors and signed-in users. With a valid Bearer the
 * extracted profile replaces UserProfile.matchingPreferences; a visitor leaves nothing stored.
 * Shares the chat's per-IP rate limit (same guard instance).
 */
@ApiTags('matching')
@ApiBearerAuth()
@Controller('matching')
@UseGuards(AssistantRateLimitGuard, OptionalAccessTokenGuard)
@UseFilters(AssistantExceptionFilter)
export class MatchingController {
  constructor(@Inject(FIND_MATCHES_USE_CASE) private readonly findMatches: FindMatchesUseCase) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Recommend up to 5 AVAILABLE animals from a free-text description' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['description'],
      properties: {
        description: { type: 'string', minLength: 1, maxLength: MATCHING_DESCRIPTION_MAX_LENGTH },
      },
    },
  })
  @ApiResponse({ status: 200, description: '{ profile, results: [{ animal, score, reasons }] }' })
  @ApiResponse({ status: 400, description: 'Invalid body (ADR-017 details)' })
  @ApiResponse({ status: 401, description: 'A Bearer token was sent but is invalid or expired' })
  @ApiResponse({ status: 429, description: 'Too many requests from this IP; see Retry-After' })
  @ApiResponse({ status: 503, description: 'The AI provider failed or gave an unusable answer' })
  async match(@Body() body: unknown, @Req() request: object): Promise<MatchingResponse> {
    const description = parseMatchingRequest(body);
    const user = optionalAuthenticatedUserOf(request);
    const { profile, results } = await this.findMatches.execute({
      userId: user?.userId ?? null,
      description,
    });
    return {
      profile,
      results: results.map(({ animal, score, reasons }) => ({
        animal: toAnimalSummary(animal),
        score,
        reasons,
      })),
    };
  }
}
