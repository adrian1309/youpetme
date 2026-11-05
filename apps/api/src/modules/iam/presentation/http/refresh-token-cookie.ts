import type { Response } from 'express';

import type { AppConfig } from '../../../../platform/configuration/app-config';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';
/** Scoped to the auth endpoints so the cookie is not sent with every API request. */
export const REFRESH_TOKEN_COOKIE_PATH = '/api/v1/auth';

function cookieOptions(settings: AppConfig['refreshCookie']) {
  return {
    httpOnly: true,
    secure: settings.secure,
    sameSite: settings.sameSite.toLowerCase() as 'strict' | 'lax' | 'none',
    path: REFRESH_TOKEN_COOKIE_PATH,
  };
}

/** The refresh token is delivered only here: HttpOnly keeps it out of reach of JavaScript. */
export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  expires: Date,
  settings: AppConfig['refreshCookie'],
): void {
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, { ...cookieOptions(settings), expires });
}

/** Same attributes as when it was set: a browser only removes a cookie that matches them. */
export function clearRefreshTokenCookie(
  response: Response,
  settings: AppConfig['refreshCookie'],
): void {
  response.clearCookie(REFRESH_TOKEN_COOKIE, cookieOptions(settings));
}

/**
 * Reads the refresh token from a raw Cookie header. Only this one cookie is ever needed, so a
 * small reader replaces a cookie-parsing middleware. Returns undefined when it is absent.
 */
export function readRefreshTokenCookie(cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined;
  for (const pair of cookieHeader.split(';')) {
    const separator = pair.indexOf('=');
    if (separator === -1 || pair.slice(0, separator).trim() !== REFRESH_TOKEN_COOKIE) continue;
    const raw = pair.slice(separator + 1).trim();
    try {
      return decodeURIComponent(raw) || undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
