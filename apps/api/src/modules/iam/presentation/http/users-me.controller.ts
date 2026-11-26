import { Controller, HttpCode, Inject, Put, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import type { MarkWelcomeSeenUseCase } from '../../application/use-cases/mark-welcome-seen.use-case';
import { MARK_WELCOME_SEEN_USE_CASE } from '../../iam.tokens';
import { AccessTokenGuard, authenticatedUserOf } from './access-token.guard';

/**
 * Endpoints about the signed-in user's own account. Bearer only, no refresh cookie, so
 * TrustedBrowserRequestGuard (ADR-002, cookie endpoints) does not apply.
 */
@ApiTags('users')
@ApiBearerAuth()
@Controller('users/me')
@UseGuards(AccessTokenGuard)
export class UsersMeController {
  constructor(
    @Inject(MARK_WELCOME_SEEN_USE_CASE) private readonly markWelcomeSeen: MarkWelcomeSeenUseCase,
  ) {}

  @Put('welcome-seen')
  @HttpCode(204)
  @ApiOperation({ summary: "Record that the user closed Diango's welcome (SCRUM-17); idempotent" })
  @ApiResponse({ status: 204, description: 'Recorded' })
  @ApiResponse({ status: 401, description: 'Missing, invalid or expired access token' })
  async welcomeSeen(@Req() request: object): Promise<void> {
    await this.markWelcomeSeen.execute(authenticatedUserOf(request).userId);
  }
}
