import { randomUUID } from 'node:crypto';

import { Body, Controller, HttpCode, Inject, Post, Res, UseFilters } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { RegisterResponse } from '@youpetme/contracts';
import type { Response } from 'express';

import { APP_CONFIG } from '../../../../platform/configuration/configuration.tokens';
import type { AppConfig } from '../../../../platform/configuration/app-config';
import type { RegisterUserUseCase } from '../../application/use-cases/register-user.use-case';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { REGISTER_USER_USE_CASE } from '../../iam.tokens';
import { IamExceptionFilter } from './iam-exception.filter';
import { setRefreshTokenCookie } from './refresh-token-cookie';
import { parseRegisterBody } from './register.request';

@ApiTags('auth')
@Controller('auth')
@UseFilters(IamExceptionFilter)
export class RegisterController {
  constructor(
    @Inject(REGISTER_USER_USE_CASE) private readonly registerUser: RegisterUserUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
  @ApiOperation({
    summary: 'Create an account and sign the visitor in (TS-IAM-001)',
    description:
      'Returns an access token in the body. The refresh token is only sent in the HttpOnly `refresh_token` cookie (SameSite and Secure from configuration, Path=/api/v1/auth).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['firstName', 'lastName', 'email', 'password', 'confirmPassword', 'termsAccepted'],
      properties: {
        firstName: { type: 'string' },
        lastName: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', minLength: 8, maxLength: 128 },
        confirmPassword: { type: 'string', format: 'password' },
        termsAccepted: { type: 'boolean', description: 'Must be true' },
        hasSeenWelcome: { type: 'boolean', default: false },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Account created; sets the refresh_token cookie' })
  @ApiResponse({ status: 400, description: 'Invalid input; `details` lists each failing field' })
  @ApiResponse({ status: 409, description: 'The email already belongs to an account' })
  @ApiResponse({ status: 500, description: 'Unexpected error (generic message)' })
  @HttpCode(201)
  async register(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RegisterResponse> {
    const parsed = parseRegisterBody(body);
    if (!parsed.ok) {
      throw new ValidationFailedError(parsed.issues);
    }

    const result = await this.registerUser.execute({
      ...parsed.command,
      correlationId: randomUUID(),
    });

    setRefreshTokenCookie(
      response,
      result.refreshToken,
      result.refreshTokenExpiresAt,
      this.config.refreshCookie,
    );
    // The response carries a credential: it must never be cached.
    response.setHeader('Cache-Control', 'no-store');

    return {
      user: { ...result.user, status: 'ACTIVE' },
      authentication: { accessToken: result.accessToken },
    };
  }
}
