import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { LOGIN_ENDPOINT } from './support/accounts.ts';
import { promoteToAdmin } from './support/database.ts';
import { API_URL } from './support/env.ts';
import { registeredVisitor } from './support/session-ui.ts';

/**
 * AI Matching against the real API with the fake AI provider (SCRUM-16): a guest describes what
 * they look for, sees a recommended animal with its reasons and opens its detail page.
 */
test('a guest describes what they look for, sees a recommended animal and opens it', async ({
  page,
  request,
}) => {
  // Given an AVAILABLE small puppy that gets on with children, registered by an ADMIN
  const admin = await registeredVisitor(request);
  promoteToAdmin(admin.email);
  const login = await request.post(LOGIN_ENDPOINT, {
    data: { email: admin.email, password: admin.password },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = ((await login.json()) as { authentication: { accessToken: string } })
    .authentication;
  const name = `Coco ${randomUUID().slice(0, 8)}`;
  const created = await request.post(`${API_URL}/api/v1/animals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      name,
      species: 'DOG',
      size: 'SMALL',
      ageGroup: 'PUPPY_KITTEN',
      compatibleWithChildren: true,
      photoUrls: ['https://images.example.com/coco.jpg'],
    },
  });
  expect(created.status()).toBe(201);

  // When a guest opens the matching page from the header and describes their situation
  await page.goto('/');
  await page.getByRole('banner').getByRole('link', { name: 'Encuentra tu compañero' }).click();
  await page
    .getByLabel('Cuéntanos sobre ti y lo que buscas')
    .fill('Busco un perro cachorro, vivo en un piso y tengo hijos');
  await page.getByRole('button', { name: 'Buscar compañero' }).click();

  // Then the animal is recommended with the reasons it fits
  const card = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name }) });
  await expect(card).toBeVisible();
  await expect(card.getByText('Encaja muy bien')).toBeVisible();
  await expect(card.getByRole('list', { name: 'Por qué encaja' })).toContainText(
    'Se lleva bien con niños',
  );

  // And its detail page opens from the card
  await card.getByRole('link', { name: `Ver ficha de ${name}` }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
});
