import { expect, type BrowserContext, type Cookie } from '@playwright/test';

export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/** The refresh-token cookie the browser holds, or undefined. */
export async function refreshTokenCookie(context: BrowserContext): Promise<Cookie | undefined> {
  const cookies = await context.cookies();
  return cookies.find(({ name }) => name === REFRESH_TOKEN_COOKIE);
}

/**
 * Asserts the cookie of ADR-002 (Cookie and CSRF Policy): HttpOnly, SameSite=Strict, scoped to
 * /api/v1/auth. `Secure` is off in the E2E stack, which runs over http://localhost
 * (COOKIE_SECURE=false); the integration tests cover it.
 */
export async function expectRefreshTokenCookie(
  context: BrowserContext,
  browserName: string,
): Promise<Cookie> {
  const cookie = await refreshTokenCookie(context);
  // Playwright's WebKit for Windows always reports None (a known failure in its own test suite).
  const reportsSameSite = !(browserName === 'webkit' && process.platform === 'win32');
  expect(cookie).toMatchObject({
    domain: 'localhost',
    path: '/api/v1/auth',
    httpOnly: true,
    ...(reportsSameSite ? { sameSite: 'Strict' } : {}),
  });
  return cookie!;
}
