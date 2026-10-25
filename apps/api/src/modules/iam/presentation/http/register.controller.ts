import { randomUUID } from 'node:crypto';

import { Body, Controller, HttpCode, Inject, Post, Res, UseFilters } from '@nestjs/common';
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

@Controller('auth')
@UseFilters(IamExceptionFilter)
export class RegisterController {
  constructor(
    @Inject(REGISTER_USER_USE_CASE) private readonly registerUser: RegisterUserUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('register')
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
