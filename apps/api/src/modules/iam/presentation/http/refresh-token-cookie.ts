import type { Response } from 'express';

import type { AppConfig } from '../../../../platform/configuration/app-config';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/** Scoped to the auth endpoints so the cookie is not sent with every API request. */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

/** The refresh token is delivered only here: HttpOnly keeps it out of reach of JavaScript. */
export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  expires: Date,
  settings: AppConfig['refreshCookie'],
): void {
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite.toLowerCase() as 'strict' | 'lax' | 'none',
    path: REFRESH_TOKEN_COOKIE_PATH,
    expires,
  });
}
