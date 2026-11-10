import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test, type Page } from '@playwright/test';

import {
  FOREIGN_ORIGIN,
  LOGIN_ENDPOINT,
  newVisitor,
  REFRESH_ENDPOINT,
} from './support/accounts.ts';
import { expectRefreshTokenCookie, refreshTokenCookie } from './support/cookies.ts';
import {
  ageSessions,
  expireSessions,
  revokeSessions,
  sessionStatuses,
  suspendAccount,
} from './support/database.ts';
import { WEB_ORIGIN } from './support/env.ts';
import { closeForeignPage, serveForeignPage } from './support/foreign-origin.ts';
import {
  accessTokenOf,
  expectSignedIn,
  expectVisitor,
  isRefresh,
  logIn,
  loginForm,
  registeredVisitor,
  reloadAndRefresh,
  submitLogin,
  useRefreshCookie,
} from './support/session-ui.ts';

/**
 * Login and session renewal against the real API and PostgreSQL (SCRUM-52, TS-IAM-002). The
 * Given/When/Then scenarios of US-IAM-002 are translated by hand (ADR-013). Locators use roles
 * and accessible labels only. Every test registers its own user, so none depends on another.
 */
const REFRESH_LOCK = 'youpetme:auth-refresh';

test.describe('US-IAM-002 — Login', () => {
  test('Scenario 1: an ACTIVE account signs in and lands on the authenticated home', async ({
    page,
    request,
  }) => {
    // Given a registered user with an ACTIVE account
    const visitor = await registeredVisitor(request);

    // When they enter their email (as typed, with spaces and capitals) and password on /login
    await page.goto('/login');
    await expect(page.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
    const response = await submitLogin(page, `  ${visitor.email.toUpperCase()} `, visitor.password);

    // Then they are authenticated and redirected to the home in its authenticated state
    expect(response.status()).toBe(200);
    await expectSignedIn(page, visitor);
  });

  test('Scenario 2: an unknown email and a wrong password get the same generic message', async ({
    page,
    request,
  }) => {
    // Given a visitor on /login, and an existing account
    const visitor = await registeredVisitor(request);
    await page.goto('/login');
    const form = loginForm(page);
    const genericMessage = 'El correo o la contraseña no son correctos.';

    // When they enter an email that is not registered
    const unknownEmail = await submitLogin(page, newVisitor().email, visitor.password);

    // Then they see the generic message, pointing at neither field
    await expect(page.getByRole('alert')).toContainText(genericMessage);
    await expect(form.email).not.toHaveAttribute('aria-invalid', 'true');
    await expect(form.password).not.toHaveAttribute('aria-invalid', 'true');

    // When they enter the registered email with a wrong password
    const wrongPassword = await submitLogin(page, visitor.email, 'not-the-password');

    // Then they see exactly the same message, and the API answered exactly the same
    await expect(page.getByRole('alert')).toContainText(genericMessage);
    await expect(form.email).not.toHaveAttribute('aria-invalid', 'true');
    await expect(form.password).not.toHaveAttribute('aria-invalid', 'true');
    expect(unknownEmail.status()).toBe(401);
    expect(wrongPassword.status()).toBe(401);
    expect(await wrongPassword.text()).toBe(await unknownEmail.text());
    expect(await unknownEmail.json()).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    await expect(page).toHaveURL('/login');
    expect(await page.context().cookies()).toEqual([]);
  });

  test('Scenario 3: an account that is not ACTIVE is reported as not available', async ({
    page,
    request,
  }) => {
    // Given an account whose status is SUSPENDED
    const visitor = await registeredVisitor(request);
    suspendAccount(visitor.email);

    // When its owner signs in with the right credentials
    await page.goto('/login');
    const response = await submitLogin(page, visitor.email, visitor.password);

    // Then they see that the account is not available, without the reason, and stay signed out
    expect(response.status()).toBe(403);
    await expect(page.getByRole('alert')).toContainText(
      'Esta cuenta no está disponible en este momento.',
    );
    await expect(page.getByRole('alert')).not.toContainText(/SUSPENDED|suspendid/i);
    await expect(page).toHaveURL('/login');
    expect(await page.context().cookies()).toEqual([]);
  });

  test('Scenario 4: signing in on a new device keeps the session on the other one', async ({
    page,
    browser,
    request,
  }) => {
    // Given a user already signed in on one device
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);

    // When they sign in on a new device
    const otherDevice = await browser.newContext({ baseURL: WEB_ORIGIN });
    try {
      const otherPage = await otherDevice.newPage();
      await logIn(otherPage, visitor);

      // Then both sessions exist and the first device is still signed in
      expect((await reloadAndRefresh(page)).status()).toBe(200);
      await expectSignedIn(page, visitor);
      expect((await reloadAndRefresh(otherPage)).status()).toBe(200);
      await expectSignedIn(otherPage, visitor);
      // The registration session plus one per device, none revoked.
      expect(sessionStatuses(visitor.email)).toEqual(['ACTIVE', 'ACTIVE', 'ACTIVE']);
    } finally {
      await otherDevice.close();
    }
  });

  test('Scenario 5: reloading the page renews the session without asking for credentials', async ({
    page,
    request,
  }) => {
    // Given a signed-in user
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const before = await refreshTokenCookie(page.context());

    // When they reload the page
    const refresh = await reloadAndRefresh(page);

    // Then the session is restored through the refresh, which rotated the refresh token
    expect(refresh.status()).toBe(200);
    await expectSignedIn(page, visitor);
    const after = await refreshTokenCookie(page.context());
    expect(after?.value).toBeTruthy();
    expect(after?.value).not.toBe(before?.value);
  });

  test('Scenario 5: a reload on /login with a session goes to the home', async ({
    page,
    request,
  }) => {
    // Given a signed-in user
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);

    // When they open /login again
    await page.goto('/login');

    // Then the restored session sends them to the home instead of the form
    await expectSignedIn(page, visitor);
    await expect(loginForm(page).email).toHaveCount(0);
  });

  test('Scenario 5: a second tab restores the same session', async ({ page, request }) => {
    // Given a signed-in user
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);

    // When they open the app in a second tab
    const secondTab = await page.context().newPage();
    const [refresh] = await Promise.all([
      secondTab.waitForResponse(isRefresh),
      secondTab.goto('/'),
    ]);

    // Then the second tab is signed in too, from the shared refresh cookie
    expect(refresh.status()).toBe(200);
    await expectSignedIn(secondTab, visitor);
  });

  test('Scenario 5: two tabs restoring at once take turns (Web Locks) and keep the session', async ({
    page,
    request,
  }) => {
    // Given a user signed in on two tabs
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const context = page.context();
    const firstTab = page;
    const secondTab = await context.newPage();
    await secondTab.goto('/');
    await expectSignedIn(secondTab, visitor);

    // Order in which the two refreshes leave the browser and come back
    const events: string[] = [];
    const tabOf = (owner: Page) => (owner === firstTab ? 'first' : 'second');
    context.on('request', (r) => {
      if (r.url() === REFRESH_ENDPOINT) events.push(`${tabOf(r.frame().page())}:sent`);
    });
    context.on('requestfinished', (r) => {
      if (r.url() === REFRESH_ENDPOINT) events.push(`${tabOf(r.frame().page())}:done`);
    });
    const statuses: number[] = [];
    context.on('response', (r) => {
      if (isRefresh(r)) statuses.push(r.status());
    });

    // The first tab's refresh is held in the browser, so its tab keeps the lock meanwhile
    let release: () => void = () => undefined;
    const released = new Promise<void>((resolve) => (release = resolve));
    let held: () => void = () => undefined;
    const isHeld = new Promise<void>((resolve) => (held = resolve));
    await firstTab.route(REFRESH_ENDPOINT, async (route) => {
      held();
      await released;
      await route.continue();
    });

    // When both tabs reload at once
    await firstTab.reload();
    await isHeld;
    await secondTab.reload();

    // Then the second tab waits for the lock instead of sending the same cookie
    await expect
      .poll(() =>
        secondTab.evaluate(async (name) => {
          const { pending = [] } = await navigator.locks.query();
          return pending.some((lock) => lock.name === name);
        }, REFRESH_LOCK),
      )
      .toBe(true);
    release();

    // And both end up signed in, one refresh after the other, with the session still active
    await expectSignedIn(firstTab, visitor);
    await expectSignedIn(secondTab, visitor);
    await firstTab.unroute(REFRESH_ENDPOINT);
    expect(statuses).toEqual([200, 200]);
    expect(events.indexOf('second:sent')).toBeGreaterThan(events.indexOf('first:done'));
    expect((await reloadAndRefresh(firstTab)).status()).toBe(200);
    await expectSignedIn(firstTab, visitor);
  });

  test('Scenario 6: an already rotated refresh token leaves the user as a visitor and revokes the session', async ({
    page,
    request,
  }) => {
    // Given a user whose refresh token has already been rotated
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    const context = page.context();
    const rotated = (await refreshTokenCookie(context))!;
    expect((await reloadAndRefresh(page)).status()).toBe(200);
    const current = (await refreshTokenCookie(context))!;

    // When the app tries to renew the session with the rotated token
    await useRefreshCookie(context, rotated);
    const reuse = await reloadAndRefresh(page);

    // Then the user is a visitor, without an error, and the session is revoked
    expect(reuse.status()).toBe(401);
    await expectVisitor(page);
    expect(sessionStatuses(visitor.email)).toContain('REVOKED');

    // And even the newer token no longer works: they have to sign in again
    await useRefreshCookie(context, current);
    expect((await reloadAndRefresh(page)).status()).toBe(401);
    await expectVisitor(page);
    await logIn(page, visitor);
  });

  test('Scenario 6: a revoked session leaves the user as a visitor', async ({ page, request }) => {
    // Given a signed-in user whose sessions were revoked (as logout or a password change will do)
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    revokeSessions(visitor.email);

    // When the app tries to renew the session
    const refresh = await reloadAndRefresh(page);

    // Then the user is a visitor, without an error
    expect(refresh.status()).toBe(401);
    await expectVisitor(page);
  });

  test('Scenario 6: an expired session leaves the user as a visitor', async ({ page, request }) => {
    // Given a signed-in user whose session has expired (7 days without use)
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    expireSessions(visitor.email);

    // When the app tries to renew the session
    const refresh = await reloadAndRefresh(page);

    // Then the user is a visitor, without an error, and the session is marked EXPIRED
    expect(refresh.status()).toBe(401);
    await expectVisitor(page);
    expect(sessionStatuses(visitor.email)).toContain('EXPIRED');
  });

  test('Scenario 6: a session older than the absolute cap (30 days) leaves the user as a visitor', async ({
    page,
    request,
  }) => {
    // Given a user who signed in 31 days ago and has kept the session alive since (SCRUM-54)
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    ageSessions(visitor.email, 31);

    // When the app tries to renew the session
    const refresh = await reloadAndRefresh(page);

    // Then the user is a visitor, the cookie is gone and the session is marked EXPIRED
    expect(refresh.status()).toBe(401);
    expect(await refresh.json()).toMatchObject({ code: 'SESSION_NOT_RENEWABLE' });
    await expectVisitor(page);
    expect(await refreshTokenCookie(page.context())).toBeUndefined();
    expect(sessionStatuses(visitor.email)).toContain('EXPIRED');
  });

  test('Scenario 5: near the absolute cap the session renews, but its cookie expires at the cap', async ({
    page,
    request,
  }) => {
    // Given a user who signed in 26 days ago (4 days left before the 30-day cap)
    const visitor = await registeredVisitor(request);
    await logIn(page, visitor);
    ageSessions(visitor.email, 26);
    const DAY = 24 * 60 * 60 * 1000;

    // When the app renews the session
    const refresh = await reloadAndRefresh(page);

    // Then the user stays signed in, and the new cookie lasts until the cap, not 7 more days
    expect(refresh.status()).toBe(200);
    await expectSignedIn(page, visitor);
    const expiresInDays =
      ((await refreshTokenCookie(page.context()))!.expires * 1000 - Date.now()) / DAY;
    expect(expiresInDays).toBeGreaterThan(3.9);
    expect(expiresInDays).toBeLessThan(4.1);
  });
});

test.describe('Session cookie and secrets (ADR-002, TS-IAM-002)', () => {
  test('the refresh token is an HttpOnly, SameSite=Strict cookie scoped to /api/v1/auth, also after a rotation', async ({
    page,
    request,
    browserName,
  }) => {
    const visitor = await registeredVisitor(request);

    // When the user signs in
    const login = await logIn(page, visitor);
    const body = (await login.json()) as { authentication: Record<string, string> };

    // Then the cookie has the ADR-002 attributes, and JavaScript reaches no token
    await expectRefreshTokenCookie(page.context(), browserName);
    expect(Object.keys(body.authentication)).toEqual(['accessToken']);
    expect(await page.evaluate(() => document.cookie)).toBe('');
    const storage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(storage).not.toContain(body.authentication.accessToken);

    // And the rotated cookie keeps them
    expect((await reloadAndRefresh(page)).status()).toBe(200);
    await expectRefreshTokenCookie(page.context(), browserName);
    expect(await page.evaluate(() => document.cookie)).toBe('');
  });

  test('no password, access token or refresh token reaches the browser console', async ({
    page,
    request,
  }) => {
    const visitor = await registeredVisitor(request);
    const messages: string[] = [];
    page.on('console', (message) => messages.push(message.text()));
    page.on('pageerror', (error) => messages.push(error.message));

    // When the user fails once, signs in and reloads
    await page.goto('/login');
    await submitLogin(page, visitor.email, 'not-the-password');
    const login = await submitLogin(page, visitor.email, visitor.password);
    // Read the bodies right away: the browser drops them after the next navigation.
    const loginToken = await accessTokenOf(login);
    await expectSignedIn(page, visitor);
    const firstCookie = (await refreshTokenCookie(page.context()))!.value;
    const refresh = await reloadAndRefresh(page);
    const refreshToken = await accessTokenOf(refresh);
    await expectSignedIn(page, visitor);

    // Then none of the secrets appears in the console
    const secrets = [
      visitor.password,
      'not-the-password',
      loginToken,
      refreshToken,
      firstCookie,
      (await refreshTokenCookie(page.context()))!.value,
    ];
    const logged = messages.join('\n');
    for (const secret of secrets) {
      expect(logged).not.toContain(secret);
    }
  });
});

test.describe('Origin and Content-Type guard on login and refresh (ADR-002)', () => {
  test('another Origin is rejected on login and refresh, and the session is left as it was', async ({
    request,
  }) => {
    const visitor = await registeredVisitor(request);
    const credentials = { email: visitor.email, password: visitor.password };

    // When a client that ignores CORS signs in with another Origin
    const foreignLogin = await request.post(LOGIN_ENDPOINT, {
      headers: { Origin: FOREIGN_ORIGIN },
      data: credentials,
    });

    // Then the API answers 403 without a business code and sets no cookie
    expect(foreignLogin.status()).toBe(403);
    expect(await foreignLogin.json()).not.toHaveProperty('code');
    expect(foreignLogin.headers()['set-cookie']).toBeUndefined();

    // Given a real session (the request context keeps its cookie)
    expect((await request.post(LOGIN_ENDPOINT, { data: credentials })).status()).toBe(200);

    // When the refresh comes with another Origin
    const foreignRefresh = await request.post(REFRESH_ENDPOINT, {
      headers: { Origin: FOREIGN_ORIGIN },
    });

    // Then it is rejected and the cookie still renews the session afterwards
    expect(foreignRefresh.status()).toBe(403);
    expect(foreignRefresh.headers()['set-cookie']).toBeUndefined();
    const sameOrigin = await request.post(REFRESH_ENDPOINT, { headers: { Origin: WEB_ORIGIN } });
    expect(sameOrigin.status()).toBe(200);
  });

  test('a body that is not JSON is rejected with 415; a refresh without a body is accepted', async ({
    request,
  }) => {
    const visitor = await registeredVisitor(request);
    const credentials = JSON.stringify({ email: visitor.email, password: visitor.password });

    // A cross-site form can only send text/plain or form bodies without a CORS preflight
    const textLogin = await request.post(LOGIN_ENDPOINT, {
      headers: { 'Content-Type': 'text/plain' },
      data: credentials,
    });
    expect(textLogin.status()).toBe(415);
    expect(textLogin.headers()['set-cookie']).toBeUndefined();

    expect(
      (await request.post(LOGIN_ENDPOINT, { data: JSON.parse(credentials) as object })).status(),
    ).toBe(200);
    const textRefresh = await request.post(REFRESH_ENDPOINT, {
      headers: { 'Content-Type': 'text/plain' },
      data: 'x',
    });
    expect(textRefresh.status()).toBe(415);

    // The web client's refresh has no body and no Content-Type, and must keep working
    expect((await request.post(REFRESH_ENDPOINT)).status()).toBe(200);
  });

  test.describe('from a page on another origin', () => {
    let foreignPage: Server;

    test.beforeEach(async () => {
      foreignPage = await serveForeignPage();
    });

    test.afterEach(() => {
      closeForeignPage(foreignPage);
    });

    test('CORS stops a browser on another origin from signing in', async ({ page, request }) => {
      const visitor = await registeredVisitor(request);

      // Given a page served from an origin other than WEB_ORIGIN
      const { port } = foreignPage.address() as AddressInfo;
      await page.goto(`http://127.0.0.1:${port}/`);

      // When it tries to sign in with credentials, as the web app does
      const outcome = await page.evaluate(
        async ({ url, body }) => {
          try {
            const response = await fetch(url, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body,
            });
            return `readable: ${response.status}`;
          } catch {
            return 'blocked';
          }
        },
        {
          url: LOGIN_ENDPOINT,
          body: JSON.stringify({ email: visitor.email, password: visitor.password }),
        },
      );

      // Then the browser blocks it and no session cookie is stored
      expect(outcome).toBe('blocked');
      expect(await page.context().cookies()).toEqual([]);
    });
  });
});
