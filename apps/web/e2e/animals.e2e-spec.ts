import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { promoteToAdmin } from './support/database.ts';
import { logIn, registeredVisitor } from './support/session-ui.ts';

/**
 * Main Animals flow against the real API and PostgreSQL (SCRUM-10, SCRUM-12, SCRUM-13): an ADMIN
 * registers an animal and a visitor finds it in the catalogue with filters and opens its detail.
 * Locators use roles and accessible labels only.
 */
test('an ADMIN registers an animal and a visitor finds it with filters and opens its detail', async ({
  page,
  request,
  browser,
}) => {
  // Given a signed-in ADMIN
  const admin = await registeredVisitor(request);
  promoteToAdmin(admin.email);
  await logIn(page, admin);
  const name = `Misi ${randomUUID().slice(0, 8)}`;

  // When they register a cat from the catalogue's admin entry
  await page.getByRole('banner').getByRole('link', { name: 'Animales' }).click();
  await page.getByRole('link', { name: 'Registrar animal' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Registrar un animal' })).toBeVisible();
  await page.getByLabel('Nombre').fill(name);
  await page.getByLabel('Especie').selectOption({ label: 'Gato' });
  await page.getByLabel('Tamaño').selectOption({ label: 'Pequeño' });
  await page.getByLabel('Edad').selectOption({ label: 'Joven' });
  // An image that is never fetched successfully in CI is fine: the test checks the text only.
  await page.getByLabel('URL de la foto').fill('https://images.example.com/misi.jpg');
  await page.getByRole('checkbox', { name: 'Juguetón' }).check();
  await page.getByLabel('¿Se lleva bien con niños?').selectOption({ label: 'Sí' });
  await page.getByRole('button', { name: 'Registrar animal' }).click();

  // Then its detail opens
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();

  // When a visitor (no session) filters the catalogue by species and compatibility
  const visitorContext = await browser.newContext();
  const visitor = await visitorContext.newPage();
  await visitor.goto('/animals');
  await visitor.getByLabel('Especie').selectOption({ label: 'Gato' });
  // The URL drives the filters, so the box turns checked once the navigation commits.
  const withChildren = visitor.getByRole('checkbox', { name: 'Bien con niños' });
  await withChildren.click();
  await expect(withChildren).toBeChecked();
  await expect(visitor).toHaveURL(/species=CAT/);
  await expect(visitor).toHaveURL(/compatibleWithChildren=true/);

  // Then the new animal is listed, and its detail shows its characteristics
  await expect(visitor.getByRole('heading', { level: 2, name })).toBeVisible();
  await visitor.getByRole('link', { name: `Ver ficha de ${name}` }).click();
  await expect(visitor.getByRole('heading', { level: 1, name })).toBeVisible();
  await expect(visitor.getByText('Juguetón')).toBeVisible();
  await expect(visitor.getByText('Bien con niños')).toBeVisible();

  // And a filter it does not match hides it
  await visitor.goto('/animals?species=DOG');
  await expect(visitor.getByRole('heading', { level: 2, name })).toHaveCount(0);
  await visitorContext.close();
});
