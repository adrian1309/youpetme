import {
  Body,
  Controller,
  HttpCode,
  Inject,
  Put,
  Req,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import {
  AccessTokenGuard,
  authenticatedUserOf,
} from '../../../iam/presentation/http/access-token.guard';
import { SAVE_MATCHING_PREFERENCES_USE_CASE } from '../../ai.tokens';
import type { SaveMatchingPreferencesUseCase } from '../../application/use-cases/save-matching-preferences.use-case';
import { AssistantExceptionFilter } from './assistant-exception.filter';
import { parseMatchingPreferencesRequest } from './matching.request';

/**
 * SCRUM-16, scenario 3: after registering, a former guest saves the profile kept in the browser.
 * Bearer only, no refresh cookie, so TrustedBrowserRequestGuard does not apply.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me/matching-preferences')
@UseGuards(AccessTokenGuard)
@UseFilters(AssistantExceptionFilter)
export class MatchingPreferencesController {
  constructor(
    @Inject(SAVE_MATCHING_PREFERENCES_USE_CASE)
    private readonly savePreferences: SaveMatchingPreferencesUseCase,
  ) {}

  @Put()
  @HttpCode(204)
  @ApiOperation({
    summary: 'Replace the AI Matching preferences (UserProfile.matchingPreferences)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      description: 'An adopter profile (ADR-010); every field optional, enums and booleans only',
    },
  })
  @ApiResponse({ status: 204, description: 'Saved' })
  @ApiResponse({ status: 400, description: 'Not a valid adopter profile (ADR-017 details)' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired access token' })
  async save(@Body() body: unknown, @Req() request: object): Promise<void> {
    const profile = parseMatchingPreferencesRequest(body);
    await this.savePreferences.execute(authenticatedUserOf(request).userId, profile);
  }
}
