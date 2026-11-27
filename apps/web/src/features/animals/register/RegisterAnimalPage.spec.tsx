import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CreateAnimalRequest } from '@youpetme/contracts';

import { AppRoutes } from '../../../app/AppRoutes';
import { detail, fakeApi, LUNA_ID, page, signedInAs } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

type Routes = Parameters<typeof fakeApi>[0];

function renderAs(role: 'USER' | 'ADMIN' | null, routes: Routes = {}) {
  const fetchMock = fakeApi(
    { 'GET /api/v1/animals': () => jsonResponse(200, page([])), ...routes },
    role ? signedInAs(role) : null,
  );
  renderWithProviders(<AppRoutes />, {
    initialEntries: ['/admin/animals/new'],
    fetch: fetchMock,
    auth: 'restore',
  });
  return fetchMock;
}

const field = (label: string) => screen.getByLabelText(label);
/** Pill choices (SCRUM-56): a radio or checkbox inside a named group. */
const group = (name: string) => within(screen.getByRole('group', { name }));
const pick = (user: ReturnType<typeof userEvent.setup>, groupName: string, option: string) =>
  user.click(group(groupName).getByRole('radio', { name: option }));
const submit = () => screen.getByRole('button', { name: 'Registrar animal' });

async function fillRequired(user = userEvent.setup()) {
  await user.type(field('Nombre'), 'Luna');
  await pick(user, 'Especie', 'Perro');
  await pick(user, 'Tamaño', 'Mediano');
  await pick(user, 'Edad', 'Adulto');
  await user.type(field('URL de la foto'), 'https://images.example.com/luna.jpg');
  return user;
}

describe('RegisterAnimalPage (/admin/animals/new, SCRUM-10)', () => {
  describe('access (only ADMIN)', () => {
    it('sends a visitor to the login page', async () => {
      renderAs(null);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' }),
      ).toBeInTheDocument();
    });

    it('sends a USER to the catalogue', async () => {
      renderAs('USER');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Animales en adopción' }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', { name: 'Registrar un animal' }),
      ).not.toBeInTheDocument();
    });

    it('shows the form to an ADMIN, without accessibility violations', async () => {
      renderAs('ADMIN');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' }),
      ).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe('Registrar un animal · YouPetMe'));
      await expectNoAxeViolations(document.body, { page: true });
    });
  });

  it('registers the animal with the admin token and opens its detail (scenario 1)', async () => {
    let sent: { body: CreateAnimalRequest; authorization: string | null } | undefined;
    renderAs('ADMIN', {
      'POST /api/v1/animals': (_url, init) => {
        sent = {
          body: JSON.parse(init?.body as string) as CreateAnimalRequest,
          authorization: new Headers(init?.headers).get('Authorization'),
        };
        return jsonResponse(201, detail());
      },
      [`GET /api/v1/animals/${LUNA_ID}`]: () => jsonResponse(200, detail()),
    });
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });

    const user = await fillRequired();
    await user.type(field('Raza (opcional)'), 'Labrador');
    await user.click(screen.getByRole('checkbox', { name: 'Tranquilo' }));
    await pick(user, '¿Se lleva bien con niños?', 'Sí');
    await user.type(field('Salud y cuidados (opcional)'), 'Necesita un jardín.');
    await user.click(submit());

    expect(await screen.findByRole('heading', { level: 1, name: 'Luna' })).toBeInTheDocument();
    expect(sent).toEqual({
      authorization: 'Bearer admin-token',
      body: {
        name: 'Luna',
        species: 'DOG',
        size: 'MEDIUM',
        ageGroup: 'ADULT',
        photoUrls: ['https://images.example.com/luna.jpg'],
        breed: 'Labrador',
        temperament: ['CALM'],
        compatibleWithChildren: true,
        compatibleWithOtherAnimals: null,
        careNotes: 'Necesita un jardín.',
      },
    });
  });

  it('shows an error per missing field and sends nothing (scenarios 2 and 3)', async () => {
    const fetchMock = renderAs('ADMIN');
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });

    await userEvent.click(submit());

    expect(await screen.findAllByText('Este campo es obligatorio.')).toHaveLength(2);
    expect(screen.getAllByText('Elige una opción.')).toHaveLength(3);
    expect(field('Nombre')).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/animals'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('starts with no species, size or age chosen, and "No se sabe" for compatibility', async () => {
    renderAs('ADMIN');
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });

    for (const name of ['Especie', 'Tamaño', 'Edad']) {
      for (const radio of group(name).getAllByRole('radio')) expect(radio).not.toBeChecked();
    }
    expect(
      group('¿Se lleva bien con niños?').getByRole('radio', { name: 'No se sabe' }),
    ).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Tranquilo' })).not.toBeChecked();
  });

  it('previews the photo once the URL is a valid https address', async () => {
    renderAs('ADMIN');
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });
    const user = userEvent.setup();

    await user.type(field('URL de la foto'), 'http://images.example.com/luna.jpg');
    expect(screen.queryByRole('img', { name: 'Vista previa de la foto' })).not.toBeInTheDocument();

    await user.clear(field('URL de la foto'));
    await user.type(field('URL de la foto'), 'https://images.example.com/luna.jpg');
    expect(screen.getByRole('img', { name: 'Vista previa de la foto' })).toHaveAttribute(
      'src',
      'https://images.example.com/luna.jpg',
    );
  });

  it('rejects a photo URL that is not https', async () => {
    renderAs('ADMIN');
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });
    const user = await fillRequired();
    await user.clear(field('URL de la foto'));
    await user.type(field('URL de la foto'), 'http://images.example.com/luna.jpg');

    await user.click(submit());

    expect(
      await screen.findByText(
        'Escribe una dirección https válida, por ejemplo https://ejemplo.com/foto.jpg.',
      ),
    ).toBeInTheDocument();
  });

  it('shows the API validation errors on their fields (scenario 4)', async () => {
    renderAs('ADMIN', {
      'POST /api/v1/animals': () =>
        jsonResponse(400, {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Validation failed',
          details: [{ field: 'species', code: 'INVALID_FORMAT', message: 'x' }],
        }),
    });
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });
    const user = await fillRequired();

    await user.click(submit());

    expect(await screen.findByText('Revisa este campo.')).toBeInTheDocument();
    expect(group('Especie').getByRole('radio', { name: 'Perro' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('explains a 403 from the API', async () => {
    renderAs('ADMIN', {
      'POST /api/v1/animals': () =>
        jsonResponse(403, { statusCode: 403, error: 'Forbidden', message: 'x' }),
    });
    await screen.findByRole('heading', { level: 1, name: 'Registrar un animal' });
    const user = await fillRequired();

    await user.click(submit());

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo un administrador puede registrar animales.',
    );
  });
});
