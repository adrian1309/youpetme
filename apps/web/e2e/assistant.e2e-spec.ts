import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { LOGIN_ENDPOINT } from './support/accounts.ts';
import { promoteToAdmin } from './support/database.ts';
import { API_URL } from './support/env.ts';
import { registeredVisitor } from './support/session-ui.ts';

// A first-time guest: no welcome mark in localStorage (the config sets one for every other spec).
test.use({ storageState: { cookies: [], origins: [] } });

/**
 * Diango against the real API with the fake AI provider (SCRUM-17, SCRUM-18): the welcome shows
 * once, closes, and the chat answers about small dogs from the real catalogue.
 */
test('a first-time guest meets Diango, closes the welcome and asks about small dogs', async ({
  page,
  request,
}) => {
  // Given an AVAILABLE small dog registered by an ADMIN
  const admin = await registeredVisitor(request);
  promoteToAdmin(admin.email);
  const login = await request.post(LOGIN_ENDPOINT, {
    data: { email: admin.email, password: admin.password },
  });
  expect(login.status()).toBe(200);
  const { accessToken } = ((await login.json()) as { authentication: { accessToken: string } })
    .authentication;
  const name = `Toby ${randomUUID().slice(0, 8)}`;
  const created = await request.post(`${API_URL}/api/v1/animals`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      name,
      species: 'DOG',
      size: 'SMALL',
      ageGroup: 'ADULT',
      photoUrls: ['https://images.example.com/toby.jpg'],
    },
  });
  expect(created.status()).toBe(201);

  // When a guest visits for the first time, Diango welcomes them centred on screen
  await page.goto('/animals');
  const welcome = page.getByRole('dialog', { name: '¡Hola! Soy Diango' });
  await expect(welcome).toBeVisible();

  // And closing it leaves Diango in its usual place
  await welcome.getByRole('button', { name: 'Entendido' }).click();
  await expect(welcome).toBeHidden();

  // When they ask about small dogs
  await page.getByRole('button', { name: 'Abrir el chat de Diango' }).click();
  await page.getByLabel('Escribe tu pregunta').fill('¿Tenéis perros pequeños?');
  await page.getByRole('button', { name: 'Enviar mensaje', exact: true }).click();

  // Then the answer comes from the catalogue
  await expect(page.getByRole('log')).toContainText(name);

  // And the welcome does not come back on the next visit
  await page.reload();
  await expect(page.getByRole('button', { name: 'Abrir el chat de Diango' })).toBeVisible();
  await expect(page.getByRole('dialog', { name: '¡Hola! Soy Diango' })).toBeHidden();
});
