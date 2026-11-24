import { expect, test, type Page } from '@playwright/test';

import { WEB_ORIGIN } from './support/env.ts';
import { emailsTo, waitForResetLink } from './support/outbox.ts';
import { expectSignedIn, registeredVisitor, submitLogin } from './support/session-ui.ts';

/**
 * Password recovery against the real API and PostgreSQL (SCRUM-26, TS-IAM-004). The API writes
 * the emails it would send into a folder (EMAIL_DELIVERY=file), so the test reads the reset link
 * there, as the user would read it in their inbox. Locators use roles and accessible labels only.
 */
const GENERIC_SENT =
  'Si hay una cuenta con ese email, te hemos enviado un enlace. Caduca en 2 horas. Si no lo ves en unos minutos, revisa la carpeta de spam o vuelve a intentarlo.';
const PASSWORD_UPDATED = 'Tu contraseña se ha actualizado. Inicia sesión con la nueva.';
const NEW_PASSWORD = 'my-new-passphrase';

async function requestResetLink(page: Page, email: string): Promise<string> {
  await page.goto('/login');
  await page.getByRole('link', { name: '¿Has olvidado tu contraseña?' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Recupera tu contraseña' }),
  ).toBeVisible();
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email);
  await page.getByRole('button', { name: 'Enviar enlace' }).click();
  await expect(page.getByRole('status').filter({ hasText: GENERIC_SENT })).toBeVisible();
  return waitForResetLink(email);
}

async function setNewPassword(page: Page, password: string) {
  await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
  await page.getByLabel('Confirmar contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Guardar contraseña' }).click();
}

test.describe('US-IAM-004 — Password recovery', () => {
  test('Scenarios 1, 3 and 5 — a link by email sets a new password; only the new one signs in', async ({
    page,
    request,
  }) => {
    const visitor = await registeredVisitor(request);

    const link = await requestResetLink(page, visitor.email);
    expect(emailsTo(visitor.email)).toHaveLength(1);

    await page.goto(link);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Crea una contraseña nueva' }),
    ).toBeVisible();
    // D8: once loaded, the token is no longer in the address bar.
    await expect(page).toHaveURL(`${WEB_ORIGIN}/reset-password`);

    // Scenario 5: a password under 8 characters is reported before sending.
    const newPassword = page.getByLabel('Nueva contraseña', { exact: true });
    await newPassword.fill('short');
    await newPassword.press('Tab');
    await expect(page.getByText('La contraseña debe tener al menos 8 caracteres.')).toBeVisible();

    await setNewPassword(page, NEW_PASSWORD);

    // D9: not signed in; /login confirms the change.
    await expect(page).toHaveURL(`${WEB_ORIGIN}/login`);
    await expect(page.getByRole('status').filter({ hasText: PASSWORD_UPDATED })).toBeVisible();

    const withOldPassword = await submitLogin(page, visitor.email, visitor.password);
    expect(withOldPassword.status()).toBe(401);
    await expect(page.getByRole('alert')).toContainText(
      'El correo o la contraseña no son correctos.',
    );

    const withNewPassword = await submitLogin(page, visitor.email, NEW_PASSWORD);
    expect(withNewPassword.status()).toBe(200);
    await expectSignedIn(page, visitor);
  });
});
