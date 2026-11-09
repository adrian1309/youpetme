import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test, type APIRequestContext, type Request } from '@playwright/test';

import {
  FOREIGN_ORIGIN,
  LOGIN_ENDPOINT,
  LOGOUT_ENDPOINT,
  REFRESH_ENDPOINT,
  type Visitor,
} from './support/accounts.ts';
import { refreshTokenCookie } from './support/cookies.ts';
import { sessionStatuses } from './support/database.ts';
import { WEB_ORIGIN } from './support/env.ts';
import { closeForeignPage, serveForeignPage } from './support/foreign-origin.ts';
import {
  accessTokenOf,
  expectSignedIn,
  expectVisitor,
  isRefresh,
  logIn,
  logOutFromHeader,
  logoutButton,
  registeredVisitor,
  reloadAndRefresh,
  useRefreshCookie,
} from './support/session-ui.ts';

/**
 * Logout against the real API and PostgreSQL (SCRUM-55, TS-IAM-003). The Given/When/Then
 * scenarios of US-IAM-003 are translated by hand (ADR-013). Locators use roles and accessible
 * labels only. Every test registers its own user, so none depends on another. Time-bound cases
 * use Playwright's clock, so they never wait for the real 5 s.
 */
const LOGOUT_TIME_LIMIT_MS = 5_000;

/** Signs in through the API only, for the guard checks; the request context keeps the cookie. */
async function apiSession(request: APIRequestContext, visitor: Visitor): Promise<string> {
  const response = await request.post(LOGIN_ENDPOINT, {
    data: { email: visitor.email, password: visitor.password },
  });
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { authentication: { accessToken: string } };
  return body.authentication.accessToken;
}

const count = (statuses: string[], status: string) => statuses.filter((s) => s === status).length;

test.describe('US-IAM-003 — Logout', () => {
  test('Scenario 1: logging out revokes the session, clears the cookie and leads to the public home', async ({
    page,
    request,
  }) => {
    // Given an authenticated user
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    expect(await refreshTokenCookie(page.context())).toBeDefined();

    // When they press "Cerrar sesión"
    const logout = await logOutFromHeader(page);

    // Then the session is revoked on the server, the cookie is gone and they see a public view
    expect(logout.status()).toBe(204);
    await expectVisitor(page);
    await expect(page).toHaveURL('/');
    expect(await refreshTokenCookie(page.context())).toBeUndefined();
    // The registration session, then the one this login opened, now revoked.
    expect(sessionStatuses(visitor.email)).toEqual(['ACTIVE', 'REVOKED']);

    // And after a reload they are still a visitor
    expect((await reloadAndRefresh(page)).status()).toBe(401);
    await expectVisitor(page);
  });

  test('Scenario 1: the action is available from any view, and leads to the public home', async ({
    page,
    request,
  }) => {
    // Given an authenticated user on a view other than the home
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    await page.goto('/terms');
    await expect(page.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);

    // When they press "Cerrar sesión"
    expect((await logOutFromHeader(page)).status()).toBe(204);

    // Then they land on the public home
    await expect(page).toHaveURL('/');
    await expectVisitor(page);
  });

  test('Scenario 1: the refresh token of the closed session no longer renews it', async ({
    page,
    request,
  }) => {
    // Given a user who logged out, and the refresh token they held before
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const closed = (await refreshTokenCookie(page.context()))!;
    await logOutFromHeader(page);

    // When that token is presented again
    const reuse = await request.post(REFRESH_ENDPOINT, {
      headers: { Cookie: `${closed.name}=${closed.value}` },
    });

    // Then it is rejected, and the browser stays a visitor even with the old cookie back
    expect(reuse.status()).toBe(401);
    expect(await reuse.json()).toMatchObject({ code: 'SESSION_NOT_RENEWABLE' });
    await useRefreshCookie(page.context(), closed);
    expect((await reloadAndRefresh(page)).status()).toBe(401);
    await expectVisitor(page);
  });

  test('Scenario 2: logging out on device A leaves the session on device B active', async ({
    page,
    browser,
    request,
  }) => {
    // Given a user with active sessions on two devices
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const deviceB = await browser.newContext({ baseURL: WEB_ORIGIN });
    try {
      const pageB = await deviceB.newPage();
      await logIn(pageB, visitor);

      // When they log out on device A
      expect((await logOutFromHeader(page)).status()).toBe(204);
      await expectVisitor(page);

      // Then device B is still signed in, also after renewing its session
      await expect(pageB.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);
      expect((await reloadAndRefresh(pageB)).status()).toBe(200);
      await expectSignedIn(pageB, visitor);
      const statuses = sessionStatuses(visitor.email);
      expect(count(statuses, 'REVOKED')).toBe(1);
      expect(count(statuses, 'ACTIVE')).toBe(2);
    } finally {
      await deviceB.close();
    }
  });

  test('Scenario 3: when the request fails on the network, the user is signed out anyway', async ({
    page,
    request,
  }) => {
    // Given an authenticated user whose logout request will fail on the network
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    await page.route(LOGOUT_ENDPOINT, (route) => route.abort('failed'));

    // When they press "Cerrar sesión"
    await logoutButton(page).click();

    // Then the client state is cleared all the same, without an error
    await expect(page).toHaveURL('/');
    await expectVisitor(page);
    // The request never reached the API, so the server session is untouched.
    expect(sessionStatuses(visitor.email)).toEqual(['ACTIVE', 'ACTIVE']);
  });

  test('Scenario 3: when the server does not answer, the user is signed out after 5 s and the request is cancelled', async ({
    page,
    request,
  }) => {
    // Given an authenticated user and a logout request that never gets an answer
    await page.clock.install();
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const pending: Request[] = [];
    await page.route(LOGOUT_ENDPOINT, (route) => {
      pending.push(route.request());
      // Never answered: the request hangs like a dead network.
    });
    const failed: Request[] = [];
    page.on('requestfailed', (failedRequest) => {
      if (failedRequest.url() === LOGOUT_ENDPOINT) failed.push(failedRequest);
    });

    // When they press "Cerrar sesión"
    await logoutButton(page).click();

    // Then the app waits for the server while showing that it is logging out...
    await expect(
      page.getByRole('banner').getByRole('button', { name: 'Cerrando sesión…' }),
    ).toHaveAttribute('aria-disabled', 'true');
    await expect.poll(() => pending.length).toBe(1);
    await page.clock.fastForward(LOGOUT_TIME_LIMIT_MS - 1_000);
    await expect(page.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);

    // ...but no longer than the time limit: then it signs out and cancels the request
    await page.clock.fastForward(1_000);
    await expect(page).toHaveURL('/');
    await expectVisitor(page);
    await expect.poll(() => failed.length).toBe(1);
  });

  test('a token renewal that finishes after the logout does not reopen the session', async ({
    page,
    request,
  }) => {
    // Given an authenticated user whose access token is no longer accepted at logout
    await page.clock.install();
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const logouts: Request[] = [];
    await page.route(LOGOUT_ENDPOINT, (route) => {
      logouts.push(route.request());
      return route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, error: 'Unauthorized', message: 'x' }),
      });
    });
    // ...and whose renewal of the session is slow: held until the logout gave up
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    let refreshHeld: () => void = () => undefined;
    const isHeld = new Promise<void>((resolve) => (refreshHeld = resolve));
    await page.route(REFRESH_ENDPOINT, async (route) => {
      refreshHeld();
      await released;
      await route.continue();
    });

    // When they log out and the time limit passes while the renewal is still running
    await logoutButton(page).click();
    await isHeld;
    await page.clock.fastForward(LOGOUT_TIME_LIMIT_MS);
    await expectVisitor(page);

    // And the renewal then succeeds
    const [renewal] = await Promise.all([page.waitForResponse(isRefresh), release()]);
    expect(renewal.status()).toBe(200);
    // Nothing visible happens when the app behaves; a reopened session would show the greeting
    // and send a second logout within milliseconds, so give the page a short, real-time window.
    await page.waitForTimeout(1_000);

    // Then the session is not reopened and no second logout is sent
    await expectVisitor(page);
    await expect(logoutButton(page)).toHaveCount(0);
    expect(logouts).toHaveLength(1);
  });

  test('another tab of the same browser becomes a visitor at once, on its own view', async ({
    page,
    request,
  }) => {
    // Given a user signed in on two tabs, the second one on /terms
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const secondTab = await page.context().newPage();
    await secondTab.goto('/terms');
    await expect(secondTab.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);

    // When they log out in the first tab
    await logOutFromHeader(page);

    // Then the second tab is signed out without a reload, and stays where it was
    await expect(secondTab.getByRole('banner')).not.toContainText('Hola');
    await expect(logoutButton(secondTab)).toHaveCount(0);
    await expect(secondTab).toHaveURL('/terms');
  });

  test('no password, access token or refresh token reaches the browser console', async ({
    page,
    request,
  }) => {
    const visitor = await registeredVisitor(request);
    const messages: string[] = [];
    page.on('console', (message) => messages.push(message.text()));
    page.on('pageerror', (error) => messages.push(error.message));

    // When the user signs in and logs out
    const login = await logIn(page, visitor);
    const accessToken = await accessTokenOf(login);
    const refreshToken = (await refreshTokenCookie(page.context()))!.value;
    await logOutFromHeader(page);
    await expectVisitor(page);

    // Then none of the secrets appears in the console
    const logged = messages.join('\n');
    for (const secret of [visitor.password, accessToken, refreshToken]) {
      expect(logged).not.toContain(secret);
    }
  });
});

test.describe('Origin, Content-Type and access-token guards on logout (ADR-002)', () => {
  test('another Origin is rejected and the session is left as it was', async ({ request }) => {
    const visitor = await registeredVisitor(request);
    const accessToken = await apiSession(request, visitor);

    // When a client that ignores CORS logs out with another Origin
    const foreign = await request.post(LOGOUT_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}`, Origin: FOREIGN_ORIGIN },
    });

    // Then the API answers 403 without a business code, sets no cookie and revokes nothing
    expect(foreign.status()).toBe(403);
    expect(await foreign.json()).not.toHaveProperty('code');
    expect(foreign.headers()['set-cookie']).toBeUndefined();
    expect(count(sessionStatuses(visitor.email), 'REVOKED')).toBe(0);
    const stillValid = await request.post(REFRESH_ENDPOINT, { headers: { Origin: WEB_ORIGIN } });
    expect(stillValid.status()).toBe(200);
  });

  test('a body that is not JSON gets 415, and no access token gets 401', async ({ request }) => {
    const visitor = await registeredVisitor(request);
    const accessToken = await apiSession(request, visitor);

    // A cross-site form can only send text/plain or form bodies without a CORS preflight
    const textBody = await request.post(LOGOUT_ENDPOINT, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'text/plain' },
      data: 'x',
    });
    expect(textBody.status()).toBe(415);

    // Logout requires a valid access token (TS-IAM-003)
    const anonymous = await request.post(LOGOUT_ENDPOINT);
    expect(anonymous.status()).toBe(401);
    expect(count(sessionStatuses(visitor.email), 'REVOKED')).toBe(0);
  });

  test('the client request (Bearer, no body, no Content-Type) logs out, and a second one is idempotent', async ({
    request,
  }) => {
    const visitor = await registeredVisitor(request);
    const accessToken = await apiSession(request, visitor);
    const headers = { Authorization: `Bearer ${accessToken}`, Origin: WEB_ORIGIN };

    const first = await request.post(LOGOUT_ENDPOINT, { headers });
    expect(first.status()).toBe(204);
    expect(first.headers()['set-cookie']).toMatch(/^refresh_token=;/);
    expect(count(sessionStatuses(visitor.email), 'REVOKED')).toBe(1);

    const second = await request.post(LOGOUT_ENDPOINT, { headers });
    expect(second.status()).toBe(204);
    expect(count(sessionStatuses(visitor.email), 'REVOKED')).toBe(1);
  });

  test.describe('from a page on another origin', () => {
    let foreignPage: Server;

    test.beforeEach(async () => {
      foreignPage = await serveForeignPage();
    });

    test.afterEach(() => {
      closeForeignPage(foreignPage);
    });

    test('CORS stops a browser on another origin from logging the user out', async ({
      page,
      request,
    }) => {
      const visitor = await registeredVisitor(request);
      const accessToken = await apiSession(request, visitor);

      // Given a page served from an origin other than WEB_ORIGIN
      const { port } = foreignPage.address() as AddressInfo;
      await page.goto(`http://127.0.0.1:${port}/`);

      // When it tries to log out with credentials and a token, as the web app does
      const outcome = await page.evaluate(
        async ({ url, token }) => {
          try {
            const response = await fetch(url, {
              method: 'POST',
              credentials: 'include',
              headers: { Authorization: `Bearer ${token}` },
            });
            return `readable: ${response.status}`;
          } catch {
            return 'blocked';
          }
        },
        { url: LOGOUT_ENDPOINT, token: accessToken },
      );

      // Then the browser blocks it and the session stays active
      expect(outcome).toBe('blocked');
      expect(count(sessionStatuses(visitor.email), 'REVOKED')).toBe(0);
    });
  });
});
