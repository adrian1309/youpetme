import {
  expect,
  type APIRequestContext,
  type BrowserContext,
  type Cookie,
  type Page,
  type Response,
} from '@playwright/test';

import {
  LOGIN_ENDPOINT,
  LOGOUT_ENDPOINT,
  newVisitor,
  REFRESH_ENDPOINT,
  REGISTER_ENDPOINT,
  registerBody,
  type Visitor,
} from './accounts.ts';

/**
 * Browser-side steps shared by the login and logout journeys (SCRUM-52, SCRUM-55). Locators use
 * roles and accessible labels only.
 */

/** Registers a fresh account through the API, as the UI cannot be the subject under test here. */
export async function registeredVisitor(request: APIRequestContext): Promise<Visitor> {
  const visitor = newVisitor();
  const response = await request.post(REGISTER_ENDPOINT, { data: registerBody(visitor) });
  expect(response.status()).toBe(201);
  return visitor;
}

export function loginForm(page: Page) {
  return {
    email: page.getByLabel('Correo electrónico', { exact: true }),
    password: page.getByLabel('Contraseña', { exact: true }),
    submit: page.getByRole('button', { name: 'Iniciar sesión' }),
  };
}

export const isLogin = (response: Response) =>
  response.url() === LOGIN_ENDPOINT && response.request().method() === 'POST';
export const isRefresh = (response: Response) =>
  response.url() === REFRESH_ENDPOINT && response.request().method() === 'POST';

/** Fills /login and submits it; returns the API's answer once the browser has it. */
export async function submitLogin(page: Page, email: string, password: string): Promise<Response> {
  const form = loginForm(page);
  await form.email.fill(email);
  await form.password.fill(password);
  const [response] = await Promise.all([page.waitForResponse(isLogin), form.submit.click()]);
  return response;
}

export async function logIn(page: Page, visitor: Visitor): Promise<Response> {
  await page.goto('/login');
  const response = await submitLogin(page, visitor.email, visitor.password);
  expect(response.status()).toBe(200);
  await expectSignedIn(page, visitor);
  return response;
}

/** Reloads the page and returns the answer to the refresh that restores the session. */
export async function reloadAndRefresh(page: Page): Promise<Response> {
  const [response] = await Promise.all([page.waitForResponse(isRefresh), page.reload()]);
  return response;
}

export async function expectSignedIn(page: Page, visitor: Visitor) {
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { level: 1, name: 'Has iniciado sesión.' })).toBeVisible();
  await expect(page.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);
}

/** The visitor home, with no greeting and no error: the user has to sign in again. */
export async function expectVisitor(page: Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'YouPetMe' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Iniciar sesión' })).toBeVisible();
  await expect(page.getByRole('banner')).not.toContainText('Hola');
  await expect(page.getByRole('alert')).toHaveCount(0);
}

export async function accessTokenOf(response: Response): Promise<string> {
  const body = (await response.json()) as { authentication: { accessToken: string } };
  return body.authentication.accessToken;
}

/** Puts a given refresh token back in the browser, as an attacker or a stale tab would send it. */
export async function useRefreshCookie(context: BrowserContext, cookie: Cookie) {
  await context.clearCookies();
  // WebKit on Windows reports SameSite=None; restore what the API actually set.
  await context.addCookies([{ ...cookie, sameSite: 'Strict' }]);
}

export const isLogout = (response: Response) =>
  response.url() === LOGOUT_ENDPOINT && response.request().method() === 'POST';

/** The logout action of the header, present on every view while signed in (TS-IAM-003). */
export function logoutButton(page: Page) {
  return page.getByRole('banner').getByRole('button', { name: 'Cerrar sesión' });
}

/** Presses "Cerrar sesión" and returns the API's answer to the logout. */
export async function logOutFromHeader(page: Page): Promise<Response> {
  const [response] = await Promise.all([
    page.waitForResponse(isLogout),
    logoutButton(page).click(),
  ]);
  return response;
}
