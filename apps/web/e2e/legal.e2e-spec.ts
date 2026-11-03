import { expect, test } from '@playwright/test';

import { API_ENV } from './support/env.ts';

/**
 * Terms of Service and Privacy Policy pages against the real API (SCRUM-47, TS-IAM-001). Both
 * pages must show the same version the API records on registration, which here is the
 * TERMS_VERSION the E2E stack starts the API with.
 */
const pages = [
  { link: /Términos de Servicio/, path: '/terms', title: 'Términos de Servicio' },
  { link: /Política de Privacidad/, path: '/privacy', title: 'Política de Privacidad' },
] as const;

test.describe('US-IAM-001 — Terms of Service and Privacy Policy', () => {
  for (const { link, path, title } of pages) {
    test(`the ${path} link opens a new tab with the server's version and keeps the form`, async ({
      page,
      context,
    }) => {
      // Given a visitor halfway through the registration form
      await page.goto('/register');
      const firstName = page.getByLabel('Nombre', { exact: true });
      await firstName.fill('Ana');

      // When they open the link next to the terms checkbox
      const [legalPage] = await Promise.all([
        context.waitForEvent('page'),
        page.getByRole('link', { name: link }).click(),
      ]);

      // Then the page opens in a new tab, marked as a draft, with the version the API records
      await expect(legalPage).toHaveURL(path);
      await expect(legalPage.getByRole('heading', { level: 1, name: title })).toBeVisible();
      await expect(legalPage.getByRole('note', { name: 'Borrador provisional' })).toBeVisible();
      await expect(legalPage.getByText(`Versión vigente: ${API_ENV.TERMS_VERSION}`)).toBeVisible();

      // And the registration form keeps what they typed
      await expect(page).toHaveURL('/register');
      await expect(firstName).toHaveValue('Ana');
    });
  }
});
