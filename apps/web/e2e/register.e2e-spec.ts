import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { expect, test, type Page, type Request } from '@playwright/test';

import {
  FOREIGN_ORIGIN,
  newVisitor,
  REGISTER_ENDPOINT,
  registerBody,
  type Visitor,
} from './support/accounts.ts';
import { expectRefreshTokenCookie } from './support/cookies.ts';
import { closeForeignPage, serveForeignPage } from './support/foreign-origin.ts';

/**
 * Registration journeys against the real API and PostgreSQL (SCRUM-48). The Given/When/Then
 * scenarios of US-IAM-001 are translated by hand (ADR-013). Locators use roles and accessible
 * labels only, and field errors are read through the field's accessible description, which also
 * proves they are associated with it.
 */
function registerForm(page: Page) {
  return {
    firstName: page.getByLabel('Nombre', { exact: true }),
    lastName: page.getByLabel('Apellidos', { exact: true }),
    email: page.getByLabel('Correo electrónico', { exact: true }),
    password: page.getByLabel('Contraseña', { exact: true }),
    confirmPassword: page.getByLabel('Confirmar contraseña', { exact: true }),
    terms: page.getByRole('checkbox', { name: /Acepto los Términos de Servicio/ }),
    submit: page.getByRole('button', { name: 'Crear cuenta' }),
  };
}

async function fillFields(page: Page, visitor: Visitor) {
  const form = registerForm(page);
  await form.firstName.fill(visitor.firstName);
  await form.lastName.fill(visitor.lastName);
  await form.email.fill(visitor.email);
  await form.password.fill(visitor.password);
  await form.confirmPassword.fill(visitor.password);
}

async function fillValidForm(page: Page, visitor: Visitor) {
  await fillFields(page, visitor);
  await registerForm(page).terms.check();
}

/** Submits the form and returns the API's answer, once the browser has received it. */
async function submitAndWaitForResponse(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse(
      (candidate) =>
        candidate.url() === REGISTER_ENDPOINT && candidate.request().method() === 'POST',
    ),
    registerForm(page).submit.click(),
  ]);
  return response;
}

/** Collects the registration POSTs, to prove that invalid forms never reach the API. */
function trackRegisterRequests(page: Page): Request[] {
  const requests: Request[] = [];
  page.on('request', (request) => {
    if (request.url() === REGISTER_ENDPOINT && request.method() === 'POST') {
      requests.push(request);
    }
  });
  return requests;
}

test.describe('US-IAM-001 — Create Account', () => {
  test.beforeEach(async ({ page }) => {
    // Given a visitor on the registration page
    await page.goto('/register');
    await expect(page.getByRole('heading', { name: 'Crea tu cuenta' })).toBeVisible();
  });

  test('Scenario 1: a valid registration signs the visitor in and redirects to /', async ({
    page,
  }) => {
    const visitor = newVisitor();

    // When they complete the form and accept the terms
    await fillValidForm(page, visitor);
    const response = await submitAndWaitForResponse(page);

    // Then the account exists, they are authenticated and they land on the authenticated area
    expect(response.status()).toBe(201);
    await expect(page).toHaveURL('/');
    await expect(page.getByRole('heading', { name: 'Tu cuenta está creada.' })).toBeVisible();
    await expect(page.getByRole('banner')).toContainText(`Hola, ${visitor.firstName}`);
  });

  test('Scenario 1: the session follows ADR-002 and survives CORS with credentials', async ({
    page,
    browserName,
  }) => {
    // When they register from WEB_ORIGIN
    await fillValidForm(page, newVisitor());
    const response = await submitAndWaitForResponse(page);
    const body = (await response.json()) as { authentication: { accessToken: string } };
    await expect(page).toHaveURL('/');

    // Then the browser stored the refresh token as an HttpOnly, SameSite=Strict cookie
    await expectRefreshTokenCookie(page.context(), browserName);

    // And JavaScript can reach neither the refresh token nor a persisted access token
    expect(await page.evaluate(() => document.cookie)).toBe('');
    expect(Object.keys(body.authentication)).toEqual(['accessToken']);
    const browserStorage = await page.evaluate(() =>
      JSON.stringify({ ...localStorage, ...sessionStorage }),
    );
    expect(browserStorage).not.toContain(body.authentication.accessToken);
  });

  test('Scenario 2: an email already in use is rejected without revealing the account', async ({
    page,
    request,
  }) => {
    // Given an account that already uses the email
    const existing = newVisitor();
    const created = await request.post(REGISTER_ENDPOINT, { data: registerBody(existing) });
    expect(created.status()).toBe(201);

    // When the visitor registers with that email
    await fillValidForm(page, { ...newVisitor(), email: existing.email });
    const response = await submitAndWaitForResponse(page);

    // Then they see that it is in use, and nothing else about the account
    expect(response.status()).toBe(409);
    await expect(registerForm(page).email).toHaveAccessibleDescription(
      'Este correo ya está en uso. Inicia sesión o prueba con otro correo.',
    );
    await expect(page).toHaveURL('/register');
    expect(await page.context().cookies()).toEqual([]);
  });

  test('Scenario 3: passwords that differ are reported before submitting', async ({ page }) => {
    const requests = trackRegisterRequests(page);
    const visitor = newVisitor();
    const form = registerForm(page);

    // When the password and its confirmation do not match
    await fillValidForm(page, visitor);
    await form.confirmPassword.fill(`${visitor.password}-different`);
    await form.confirmPassword.blur();

    // Then the confirmation field shows the error, and submitting does not reach the API
    const mismatch = 'Las contraseñas deben coincidir. Revisa que las dos sean iguales.';
    await expect(form.confirmPassword).toHaveAccessibleDescription(mismatch);
    await form.submit.click();
    await expect(form.confirmPassword).toBeFocused();
    await expect(form.confirmPassword).toHaveAccessibleDescription(mismatch);
    expect(requests).toHaveLength(0);
  });

  test('Scenario 4: a password below the policy is reported before submitting', async ({
    page,
  }) => {
    const requests = trackRegisterRequests(page);
    const form = registerForm(page);

    // When the password has fewer than 8 characters
    await fillValidForm(page, { ...newVisitor(), password: 'short' });
    await form.password.blur();

    // Then the error explains the minimum, and submitting does not reach the API
    const tooShort = /La contraseña debe tener al menos 8 caracteres\./;
    await expect(form.password).toHaveAccessibleDescription(tooShort);
    await form.submit.click();
    await expect(form.password).toBeFocused();
    await expect(form.password).toHaveAccessibleDescription(tooShort);
    expect(requests).toHaveLength(0);
  });

  test('Scenario 5: the form is not sent without accepting the terms', async ({ page }) => {
    const requests = trackRegisterRequests(page);
    const form = registerForm(page);

    // When they try to submit without ticking the box
    await fillFields(page, newVisitor());
    await form.submit.click();

    // Then the box shows the error and the form is not sent
    await expect(form.terms).toHaveAccessibleDescription(
      'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
    );
    await expect(form.terms).toBeFocused();
    expect(requests).toHaveLength(0);
  });

  test('Scenario 5: a box ticked and then unticked still stops the form and gets the focus', async ({
    page,
  }) => {
    const requests = trackRegisterRequests(page);
    const form = registerForm(page);

    // When they untick the box and click submit while it still has the focus
    await fillValidForm(page, newVisitor());
    await form.terms.uncheck();
    // WebKit does not focus a clicked checkbox.
    await form.terms.focus();
    await form.submit.click();

    // Then the box shows the error and gets the focus, and the form is not sent. The error must
    // not appear on pressing the button: it would push the button away from the pointer, and the
    // browser would fire no click, leaving the focus on the button.
    await expect(form.terms).toHaveAccessibleDescription(
      'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
    );
    await expect(form.terms).toBeFocused();
    expect(requests).toHaveLength(0);
  });

  test('Scenario 6: every empty required field gets its own error', async ({ page }) => {
    const requests = trackRegisterRequests(page);
    const form = registerForm(page);

    // When they submit the empty form
    await form.submit.click();

    // Then each field shows a specific error and the form is not sent
    await expect(form.firstName).toHaveAccessibleDescription('Escribe tu nombre para continuar.');
    await expect(form.lastName).toHaveAccessibleDescription(
      'Escribe tus apellidos para continuar.',
    );
    await expect(form.email).toHaveAccessibleDescription('Escribe tu correo electrónico.');
    await expect(form.password).toHaveAccessibleDescription(/Crea una contraseña para continuar\./);
    await expect(form.confirmPassword).toHaveAccessibleDescription(
      'Repite la contraseña para confirmarla.',
    );
    await expect(form.terms).toHaveAccessibleDescription(
      'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
    );
    await expect(form.firstName).toBeFocused();
    expect(requests).toHaveLength(0);
  });
});

/**
 * A blur error must not move the page between pressing and releasing the pointer: the release
 * would land on another element and the browser would fire no click (SCRUM-51). The clicks are
 * real pointer presses, so only a real browser with layout can show it.
 */
test.describe('A blur error does not swallow the click that caused it (SCRUM-51)', () => {
  const mismatch = 'Las contraseñas deben coincidir. Revisa que las dos sean iguales.';

  test.beforeEach(async ({ page }) => {
    // Given a visitor whose password confirmation does not match and still has the focus
    await page.goto('/register');
    const form = registerForm(page);
    await form.password.fill('my-secure-passphrase');
    await form.confirmPassword.fill('something-else');
    await form.confirmPassword.focus();
  });

  test('a single click ticks the terms box', async ({ page }) => {
    const form = registerForm(page);

    // When they click the terms box once
    await form.terms.click();

    // Then the box is ticked and the confirmation shows its error
    await expect(form.terms).toBeChecked();
    await expect(form.confirmPassword).toHaveAccessibleDescription(mismatch);
  });

  test('a single click on the submit button stops the form and focuses the error', async ({
    page,
  }) => {
    const requests = trackRegisterRequests(page);
    const form = registerForm(page);
    await form.firstName.fill('John');
    await form.lastName.fill('Doe');
    await form.email.fill(newVisitor().email);
    await form.terms.check();
    await form.confirmPassword.focus();

    // When they click the submit button once
    await form.submit.click();

    // Then the click reached the form: it focused the first error instead of leaving the focus
    // where the press put it
    await expect(form.confirmPassword).toBeFocused();
    await expect(form.confirmPassword).toHaveAccessibleDescription(mismatch);
    expect(requests).toHaveLength(0);
  });

  test.describe('on a touch screen', () => {
    // A tap blurs the field on the mousedown that the browser emulates after the touch ends.
    test.use({ hasTouch: true });

    test('a single tap ticks the terms box', async ({ page }) => {
      const form = registerForm(page);

      // When they tap the terms box once
      await form.terms.tap();

      // Then the box is ticked and the confirmation shows its error
      await expect(form.terms).toBeChecked();
      await expect(form.confirmPassword).toHaveAccessibleDescription(mismatch);
    });
  });

  test('a single click on the show toggle of the confirmation shows it', async ({ page }) => {
    const form = registerForm(page);
    await form.password.fill('short');
    await form.password.focus();

    // When they click the toggle below the password, whose error appears on leaving it
    await page.getByRole('button', { name: 'Mostrar confirmación de contraseña' }).click();

    // Then the confirmation becomes visible
    await expect(form.confirmPassword).toHaveAttribute('type', 'text');
    await expect(form.password).toHaveAccessibleDescription(
      /La contraseña debe tener al menos 8 caracteres\./,
    );
  });
});

test.describe('Registration from another origin (SCRUM-48)', () => {
  let foreignPage: Server;

  test.beforeEach(async () => {
    foreignPage = await serveForeignPage();
  });

  test.afterEach(() => {
    closeForeignPage(foreignPage);
  });

  test('CORS stops a browser on another origin', async ({ page, request }) => {
    const visitor = newVisitor();

    // Given a page served from an origin other than WEB_ORIGIN
    const { port } = foreignPage.address() as AddressInfo;
    await page.goto(`http://127.0.0.1:${port}/`);

    // When it tries to register with credentials, as the web app does
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
      { url: REGISTER_ENDPOINT, body: JSON.stringify(registerBody(visitor)) },
    );

    // Then the browser blocks it, no cookie is stored and the email stays free
    expect(outcome).toBe('blocked');
    expect(await page.context().cookies()).toEqual([]);
    const accepted = await request.post(REGISTER_ENDPOINT, { data: registerBody(visitor) });
    expect(accepted.status()).toBe(201);
  });

  test('the Origin guard rejects another origin even if CORS is bypassed', async ({ request }) => {
    const data = registerBody(newVisitor());

    // When a client that ignores CORS sends another Origin
    const rejected = await request.post(REGISTER_ENDPOINT, {
      headers: { Origin: FOREIGN_ORIGIN },
      data,
    });

    // Then the API answers 403 with no cookie, and the email stays free
    expect(rejected.status()).toBe(403);
    expect(rejected.headers()['set-cookie']).toBeUndefined();
    const accepted = await request.post(REGISTER_ENDPOINT, { data });
    expect(accepted.status()).toBe(201);
  });
});
