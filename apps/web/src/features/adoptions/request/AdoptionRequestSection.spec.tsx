import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRoutes } from '../../../app/AppRoutes';
import { detail, fakeApi, LUNA_ID, signedInAs } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

const DETAIL = `GET /api/v1/animals/${LUNA_ID}`;
const SUBMIT = 'POST /api/v1/adoption-requests';

const created = {
  id: 'r-1',
  status: 'PENDING',
  message: null,
  createdAt: '2026-11-25T10:00:00.000Z',
  decidedAt: null,
  animal: { id: LUNA_ID, name: 'Luna', status: 'AVAILABLE' },
  applicant: { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com' },
};

const conflict = (code: string) =>
  jsonResponse(409, { statusCode: 409, error: 'Conflict', message: 'x', code });

function renderPage(
  role: 'USER' | 'ADMIN' | null,
  routes: Parameters<typeof fakeApi>[0] = {},
  animal = detail(),
) {
  const fetchMock = fakeApi(
    { [DETAIL]: () => jsonResponse(200, animal), ...routes },
    role ? signedInAs(role) : null,
  );
  const result = renderWithProviders(<AppRoutes />, {
    initialEntries: [`/animals/${LUNA_ID}`],
    fetch: fetchMock,
    auth: 'restore',
  });
  return { ...result, fetchMock };
}

const openButton = () => screen.findByRole('button', { name: 'Solicitar adopción' });

async function openForm() {
  const user = userEvent.setup();
  await user.click(await openButton());
  return user;
}

describe('Adoption request on the animal page (SCRUM-14)', () => {
  it('sends a request with the optional message and confirms it (scenario 1)', async () => {
    let sent: unknown;
    const { fetchMock } = renderPage('USER', {
      [SUBMIT]: (_url, init) => {
        sent = JSON.parse(init!.body as string);
        return jsonResponse(201, { ...created, message: 'Tengo jardín' });
      },
    });
    const user = await openForm();

    expect(screen.getByRole('form', { name: 'Solicitar la adopción de Luna' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Mensaje para el refugio (opcional)'), 'Tengo jardín');
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    const notice = await screen.findByText(/Hemos recibido tu solicitud para adoptar a Luna\./);
    expect(notice.closest('[role="status"]')).not.toBeNull();
    expect(sent).toEqual({ animalId: LUNA_ID, message: 'Tengo jardín' });
    const submit = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST' && init.body);
    expect(new Headers(submit![1]!.headers).get('Authorization')).toBe('Bearer user-token');
    expect(screen.queryByRole('button', { name: 'Solicitar adopción' })).not.toBeInTheDocument();
  });

  it('sends no message when the box is left empty', async () => {
    let sent: unknown;
    renderPage('USER', {
      [SUBMIT]: (_url, init) => {
        sent = JSON.parse(init!.body as string);
        return jsonResponse(201, created);
      },
    });
    const user = await openForm();

    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await screen.findByText(/Hemos recibido tu solicitud/);
    expect(sent).toEqual({ animalId: LUNA_ID, message: null });
  });

  it('has no accessibility violations with the form open', async () => {
    const { container } = renderPage('USER');
    await openForm();

    await expectNoAxeViolations(container, { page: true });
  });

  it('sends a visitor to the login page, remembering the animal (scenario 2)', async () => {
    renderPage(null);
    const user = userEvent.setup();

    await user.click(await openButton());

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });

  it.each(['RESERVED', 'ADOPTED'] as const)(
    'offers no request for a %s animal (scenario 3)',
    async (status) => {
      renderPage('USER', {}, detail({ status }));

      await screen.findByText(/ya no está disponible/);
      expect(screen.queryByRole('button', { name: 'Solicitar adopción' })).not.toBeInTheDocument();
    },
  );

  it('says the user already has an active request (scenario 4)', async () => {
    renderPage('USER', { [SUBMIT]: () => conflict('ADOPTION_REQUEST_ACTIVE') });
    const user = await openForm();

    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Ya tienes una solicitud activa para este animal.',
    );
    expect(screen.queryByRole('button', { name: 'Enviar solicitud' })).not.toBeInTheDocument();
  });

  it('reloads the animal when it stopped being available meanwhile', async () => {
    let status = 'AVAILABLE';
    renderPage('USER', {
      [DETAIL]: () => jsonResponse(200, detail({ status: status as 'AVAILABLE' })),
      [SUBMIT]: () => {
        status = 'RESERVED';
        return conflict('ANIMAL_NOT_AVAILABLE');
      },
    });
    const user = await openForm();

    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(
      await screen.findByText('Este animal ya no está disponible para adopción (Reservado).'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Solicitar adopción' })).not.toBeInTheDocument();
  });

  it('rejects a message over 1000 characters without sending it', async () => {
    const { fetchMock } = renderPage('USER');
    const user = await openForm();
    const box = screen.getByLabelText('Mensaje para el refugio (opcional)');

    await user.click(box);
    await user.paste('a'.repeat(1001));
    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(box).toHaveAccessibleDescription(
      expect.stringContaining('El mensaje puede tener como máximo 1000 caracteres.'),
    );
    expect(box).toHaveFocus();
    expect(fetchMock.mock.calls.some(([, init]) => init?.body)).toBe(false);
  });

  it('shows a generic error when the request fails', async () => {
    renderPage('USER', {
      [SUBMIT]: () =>
        jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
    });
    const user = await openForm();

    await user.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hemos podido enviar la solicitud.',
    );
    expect(screen.getByRole('button', { name: 'Enviar solicitud' })).toBeInTheDocument();
  });

  it('lets the user close the form without sending anything', async () => {
    renderPage('USER');
    const user = await openForm();

    await user.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => expect(screen.queryByRole('form')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Solicitar adopción' })).toHaveFocus();
  });
});

describe('Admin link on the animal page (SCRUM-15)', () => {
  it('links an ADMIN to the requests of this animal, whatever its status', async () => {
    renderPage('ADMIN', {}, detail({ status: 'RESERVED' }));

    expect(
      await screen.findByRole('link', { name: 'Ver las solicitudes de adopción de Luna' }),
    ).toHaveAttribute('href', `/admin/adoption-requests?animalId=${LUNA_ID}`);
  });

  it('is not shown to a USER', async () => {
    renderPage('USER');

    await openButton();
    expect(screen.queryByRole('link', { name: /solicitudes de adopción/ })).not.toBeInTheDocument();
  });
});
