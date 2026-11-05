import { randomUUID } from 'node:crypto';

import { Body, Controller, HttpCode, Inject, Post, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { LoginResponse, RefreshResponse } from '@youpetme/contracts';
import type { Request, Response } from 'express';

import type { AppConfig } from '../../../../platform/configuration/app-config';
import { APP_CONFIG } from '../../../../platform/configuration/configuration.tokens';
import { TrustedBrowserRequestGuard } from '../../../../platform/http/trusted-browser-request.guard';
import type { AuthenticatedSessionResult } from '../../application/dto/authenticated-session.result';
import type { LoginUserUseCase } from '../../application/use-cases/login-user.use-case';
import type { RefreshSessionUseCase } from '../../application/use-cases/refresh-session.use-case';
import { SessionNotRenewableError } from '../../domain/errors/session-not-renewable.error';
import { ValidationFailedError } from '../../domain/errors/validation-failed.error';
import { LOGIN_USER_USE_CASE, REFRESH_SESSION_USE_CASE } from '../../iam.tokens';
import { parseLoginBody } from './login.request';
import {
  clearRefreshTokenCookie,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from './refresh-token-cookie';

/**
 * Login and session renewal (TS-IAM-002). Both read or set the refresh-token cookie, so both sit
 * behind the Origin/Content-Type guard on top of SameSite and CORS.
 */
@ApiTags('auth')
@Controller('auth')
@UseGuards(TrustedBrowserRequestGuard)
export class AuthSessionController {
  constructor(
    @Inject(LOGIN_USER_USE_CASE) private readonly loginUser: LoginUserUseCase,
    @Inject(REFRESH_SESSION_USE_CASE) private readonly refreshSession: RefreshSessionUseCase,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @Post('login')
  @ApiOperation({
    summary: 'Sign an existing user in, opening a new session (TS-IAM-002)',
    description:
      'Returns an access token in the body. The refresh token is only sent in the HttpOnly `refresh_token` cookie (SameSite and Secure from configuration, Path=/api/v1/auth).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Signed in; sets the refresh_token cookie' })
  @ApiResponse({ status: 400, description: 'Invalid input; `details` lists each failing field' })
  @ApiResponse({
    status: 401,
    description: 'Unknown email or wrong password, indistinguishably (`code`: INVALID_CREDENTIALS)',
  })
  @ApiResponse({
    status: 403,
    description:
      'Account not ACTIVE (`code`: ACCOUNT_NOT_AVAILABLE), or Origin different from WEB_ORIGIN (no `code`)',
  })
  @ApiResponse({ status: 415, description: 'Content-Type is not application/json' })
  @ApiResponse({ status: 500, description: 'Unexpected error (generic message)' })
  @HttpCode(200)
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponse> {
    const parsed = parseLoginBody(body);
    if (!parsed.ok) {
      throw new ValidationFailedError(parsed.issues);
    }
    const result = await this.loginUser.execute({ ...parsed.command, correlationId: randomUUID() });
    return this.signedIn(result, response);
  }

  @Post('refresh')
  @ApiOperation({
    summary: 'Renew the session and rotate its refresh token (TS-IAM-002)',
    description:
      'No body: the refresh token is read from the HttpOnly `refresh_token` cookie and replaced by a new one. Reusing an already rotated token revokes the session.',
  })
  @ApiResponse({ status: 200, description: 'Renewed; sets the rotated refresh_token cookie' })
  @ApiResponse({
    status: 401,
    description:
      'Cookie missing, invalid, expired or already rotated, or session not ACTIVE (`code`: SESSION_NOT_RENEWABLE); clears the refresh_token cookie',
  })
  @ApiResponse({
    status: 403,
    description:
      'Account not ACTIVE (`code`: ACCOUNT_NOT_AVAILABLE), or Origin different from WEB_ORIGIN (no `code`)',
  })
  @ApiResponse({ status: 500, description: 'Unexpected error (generic message)' })
  @HttpCode(200)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<RefreshResponse> {
    let result: AuthenticatedSessionResult;
    try {
      result = await this.refreshSession.execute({
        refreshToken: readRefreshTokenCookie(request.headers.cookie),
      });
    } catch (error) {
      if (error instanceof SessionNotRenewableError) {
        // The cookie can never work again: stop the browser from sending it.
        clearRefreshTokenCookie(response, this.config.refreshCookie);
      }
      throw error;
    }
    return this.signedIn(result, response);
  }

  private signedIn(result: AuthenticatedSessionResult, response: Response): LoginResponse {
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
