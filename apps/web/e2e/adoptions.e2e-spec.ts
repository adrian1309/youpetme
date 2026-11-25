import { randomUUID } from 'node:crypto';

import { expect, test } from '@playwright/test';

import { promoteToAdmin } from './support/database.ts';
import { API_URL } from './support/env.ts';
import { accessTokenOf, logIn, registeredVisitor, submitLogin } from './support/session-ui.ts';

/**
 * Main adoption flow against the real API and PostgreSQL (SCRUM-14, SCRUM-15): a user asks to
 * adopt an AVAILABLE animal (signing in on the way), the ADMIN approves and completes the request,
 * and the animal ends up ADOPTED and out of the catalogue. Locators use roles and labels only.
 */
test('a user requests an adoption and the ADMIN approves and completes it', async ({
  page,
  request,
  browser,
}) => {
  // Given an ADMIN and an AVAILABLE animal registered by them
  const admin = await registeredVisitor(request);
  promoteToAdmin(admin.email);
  const token = await accessTokenOf(await logIn(page, admin));
  const name = `Toby ${randomUUID().slice(0, 8)}`;
  const created = await request.post(`${API_URL}/api/v1/animals`, {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name,
      species: 'DOG',
      size: 'SMALL',
      ageGroup: 'PUPPY_KITTEN',
      photoUrls: ['https://images.example.com/toby.jpg'],
    },
  });
  expect(created.status()).toBe(201);
  const { id } = (await created.json()) as { id: string };

  // And a registered user who is not signed in yet
  const applicant = await registeredVisitor(request);
  const userContext = await browser.newContext();
  const user = await userContext.newPage();

  // When they ask to adopt from the animal page, they sign in and come back to it
  await user.goto(`/animals/${id}`);
  await user.getByRole('button', { name: 'Solicitar adopción' }).click();
  await expect(user.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeVisible();
  expect((await submitLogin(user, applicant.email, applicant.password)).status()).toBe(200);
  await expect(user).toHaveURL(`/animals/${id}`);
  await expect(user.getByRole('banner')).toContainText(`Hola, ${applicant.firstName}`);

  // And send the request with a message
  await user.getByRole('button', { name: 'Solicitar adopción' }).click();
  await user.getByLabel('Mensaje para el refugio (opcional)').fill('Tengo un jardín grande.');
  await user.getByRole('button', { name: 'Enviar solicitud' }).click();

  // Then it is confirmed
  await expect(user.getByText(`Hemos recibido tu solicitud para adoptar a ${name}.`)).toBeVisible();

  // When the ADMIN opens the requests of that animal and approves it
  await page.goto(`/animals/${id}`);
  await page.getByRole('link', { name: `Ver las solicitudes de adopción de ${name}` }).click();
  const card = page.getByRole('article', { name: `Solicitud para ${name}` });
  await expect(card).toContainText(applicant.email);
  await expect(card).toContainText('Tengo un jardín grande.');
  await card.getByRole('button', { name: /^Aprobar/ }).click();
  await expect(page.getByText(`Solicitud aprobada. ${name} queda reservado.`)).toBeVisible();
  await expect(card).toContainText('Estado: Aprobada');

  // And completes the adoption
  await card.getByRole('button', { name: /^Completar adopción/ }).click();
  await expect(page.getByText(`Adopción completada. ${name} ya está adoptado.`)).toBeVisible();
  await expect(card).toContainText('Estado: Completada');
  await expect(card.getByRole('button')).toHaveCount(0);

  // Then the animal is ADOPTED and no longer in the catalogue
  await user.goto('/animals?species=DOG');
  await expect(user.getByRole('heading', { level: 1, name: 'Animales en adopción' })).toBeVisible();
  await expect(user.getByRole('heading', { level: 2, name })).toHaveCount(0);
  await user.goto(`/animals/${id}`);
  await expect(
    user.getByText('Este animal ya no está disponible para adopción (Adoptado).'),
  ).toBeVisible();
  await expect(user.getByRole('button', { name: 'Solicitar adopción' })).toHaveCount(0);
  await userContext.close();
});
