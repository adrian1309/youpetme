import { Body, Controller, HttpCode, Inject, Post, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type {
  PasswordResetConfirmedResponse,
  PasswordResetRequestedResponse,
} from '@youpetme/contracts';
import type { Response } from 'express';

import { TrustedBrowserRequestGuard } from '../../../../platform/http/trusted-browser-request.guard';
import type { RequestPasswordResetUseCase } from '../../application/use-cases/request-password-reset.use-case';
import type { ResetPasswordUseCase } from '../../application/use-cases/reset-password.use-case';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { REQUEST_PASSWORD_RESET_USE_CASE, RESET_PASSWORD_USE_CASE } from '../../iam.tokens';
import {
  parsePasswordResetConfirmBody,
  parsePasswordResetRequestBody,
} from './password-reset.request';

const REQUESTED: PasswordResetRequestedResponse = {
  message: 'If an account exists for this email, a reset link has been sent.',
};
const CONFIRMED: PasswordResetConfirmedResponse = {
  message: 'Password has been reset successfully.',
};

/**
 * Password recovery (TS-IAM-004). Neither endpoint touches the refresh-token cookie, but both
 * change account state from a browser form, so they sit behind the same Origin/Content-Type
 * guard as the other authentication endpoints (ADR-002).
 */
@ApiTags('auth')
@Controller('auth/password-reset')
@UseGuards(TrustedBrowserRequestGuard)
export class PasswordResetController {
  constructor(
    @Inject(REQUEST_PASSWORD_RESET_USE_CASE)
    private readonly requestPasswordReset: RequestPasswordResetUseCase,
    @Inject(RESET_PASSWORD_USE_CASE) private readonly resetPassword: ResetPasswordUseCase,
  ) {}

  @Post('request')
  @ApiOperation({
    summary: 'Email a password reset link (TS-IAM-004)',
    description:
      'Always answers 202 with the same body, whether or not an account exists for the email, and the email is sent after the response. Only ACTIVE accounts receive a link, at most one a minute; a new link supersedes the previous one.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email'],
      properties: { email: { type: 'string', format: 'email' } },
    },
  })
  @ApiResponse({ status: 202, description: 'Generic confirmation, for any well-formed email' })
  @ApiResponse({ status: 400, description: 'Invalid input; `details` lists each failing field' })
  @ApiResponse({ status: 403, description: 'Origin different from WEB_ORIGIN' })
  @ApiResponse({ status: 415, description: 'Content-Type present and not application/json' })
  @ApiResponse({ status: 500, description: 'Unexpected error (generic message)' })
  @HttpCode(202)
  async request(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasswordResetRequestedResponse> {
    const parsed = parsePasswordResetRequestBody(body);
    if (!parsed.ok) {
      throw new ValidationFailedError(parsed.issues);
    }
    await this.requestPasswordReset.execute(parsed.command);
    response.setHeader('Cache-Control', 'no-store');
    return REQUESTED;
  }

  @Post('confirm')
  @ApiOperation({
    summary: 'Set a new password with a reset link (TS-IAM-004)',
    description:
      'Consumes the link and revokes every session of the user. Does not sign the user in: they log in again with the new password.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token', 'password', 'confirmPassword'],
      properties: {
        token: { type: 'string' },
        password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
        confirmPassword: { type: 'string', format: 'password' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Password changed; every session revoked' })
  @ApiResponse({
    status: 400,
    description:
      'Invalid input (`details` lists each failing field), or a link that is unknown, used, expired or superseded, or whose account is not ACTIVE (`code`: RESET_TOKEN_INVALID)',
  })
  @ApiResponse({ status: 403, description: 'Origin different from WEB_ORIGIN' })
  @ApiResponse({ status: 415, description: 'Content-Type present and not application/json' })
  @ApiResponse({ status: 500, description: 'Unexpected error (generic message)' })
  @HttpCode(200)
  async confirm(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PasswordResetConfirmedResponse> {
    const parsed = parsePasswordResetConfirmBody(body);
    if (!parsed.ok) {
      throw new ValidationFailedError(parsed.issues);
    }
    await this.resetPassword.execute(parsed.command);
    response.setHeader('Cache-Control', 'no-store');
    return CONFIRMED;
  }
}
