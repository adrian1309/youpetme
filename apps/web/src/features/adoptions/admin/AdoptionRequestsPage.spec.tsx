import type { AdoptionRequestItem } from '@youpetme/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRoutes } from '../../../app/AppRoutes';
import { fakeApi, LUNA_ID, signedInAs } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

const LIST = 'GET /api/v1/adoption-requests';

function item(overrides: Partial<AdoptionRequestItem> = {}): AdoptionRequestItem {
  return {
    id: 'r-1',
    status: 'PENDING',
    message: 'Tengo jardín',
    createdAt: '2026-11-25T10:00:00.000Z',
    decidedAt: null,
    animal: { id: LUNA_ID, name: 'Luna', status: 'AVAILABLE' },
    applicant: { firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com' },
    ...overrides,
  };
}

const list = (items: AdoptionRequestItem[], extra = {}) =>
  jsonResponse(200, { items, page: 1, pageSize: 12, total: items.length, ...extra });

function renderPage(
  routes: Parameters<typeof fakeApi>[0],
  { path = '/admin/adoption-requests', role = 'ADMIN' as 'ADMIN' | 'USER' | null } = {},
) {
  const fetchMock = fakeApi(routes, role ? signedInAs(role) : null);
  const result = renderWithProviders(<AppRoutes />, {
    initialEntries: [path],
    fetch: fetchMock,
    auth: 'restore',
  });
  return { ...result, fetchMock };
}

const listUrls = (fetchMock: ReturnType<typeof fakeApi>) =>
  fetchMock.mock.calls
    .map(([input]) => new URL(String(input)))
    .filter((url) => url.pathname === '/api/v1/adoption-requests');

const row = (name = 'Solicitud para Luna') => screen.findByRole('article', { name });

describe('AdoptionRequestsPage (/admin/adoption-requests, SCRUM-15)', () => {
  it('lists the requests with the applicant, the message and the status', async () => {
    const { fetchMock } = renderPage({ [LIST]: () => list([item()]) });

    const article = await row();
    expect(
      screen.getByRole('heading', { level: 1, name: 'Solicitudes de adopción' }),
    ).toBeVisible();
    for (const text of ['Ana Ruiz', 'ana@example.com', 'Tengo jardín', 'Estado: Pendiente']) {
      expect(within(article).getByText(text)).toBeInTheDocument();
    }
    expect(within(article).getByRole('link', { name: 'Luna' })).toHaveAttribute(
      'href',
      `/animals/${LUNA_ID}`,
    );
    expect(screen.getByText('1 solicitud')).toBeInTheDocument();
    const [, init] = fetchMock.mock.calls.find(([input]) => String(input).includes('adoption'))!;
    expect(new Headers(init!.headers).get('Authorization')).toBe('Bearer admin-token');
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage({ [LIST]: () => list([item()]) });
    await row();

    await expectNoAxeViolations(container, { page: true });
  });

  it.each([
    ['PENDING', ['Aprobar', 'Rechazar']],
    ['APPROVED', ['Completar adopción', 'Cancelar aprobación']],
    ['REJECTED', []],
    ['COMPLETED', []],
    ['CANCELLED', []],
  ] as const)('offers only the valid actions for a %s request', async (status, actions) => {
    renderPage({ [LIST]: () => list([item({ status })]) });

    const article = await row();
    expect(
      within(article)
        .queryAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(actions);
  });

  it.each([
    ['approve', 'Aprobar', 'APPROVED', 'Solicitud aprobada. Luna queda reservado.'],
    ['reject', 'Rechazar', 'REJECTED', 'Solicitud rechazada. Luna sigue disponible.'],
  ] as const)(
    '%s: calls the action, confirms it and refreshes the list',
    async (action, label, nextStatus, done) => {
      let current = item();
      const calls: string[] = [];
      renderPage({
        [LIST]: () => list([current]),
        [`POST /api/v1/adoption-requests/r-1/${action}`]: () => {
          calls.push(action);
          current = item({ status: nextStatus });
          return jsonResponse(200, current);
        },
      });
      const user = userEvent.setup();

      await user.click(
        within(await row()).getByRole('button', {
          name: `${label} la solicitud de Ana Ruiz para Luna`,
        }),
      );

      expect(await screen.findByText(done)).toBeInTheDocument();
      expect(calls).toEqual([action]);
      await waitFor(() =>
        expect(
          screen.getByText(`Estado: ${nextStatus === 'APPROVED' ? 'Aprobada' : 'Rechazada'}`),
        ).toBeInTheDocument(),
      );
    },
  );

  it.each([
    ['complete', 'Completar adopción', 'Adopción completada. Luna ya está adoptado.'],
    ['cancel', 'Cancelar aprobación', 'Aprobación cancelada. Luna vuelve a estar disponible.'],
  ] as const)('%s an APPROVED request', async (action, label, done) => {
    renderPage({
      [LIST]: () => list([item({ status: 'APPROVED' })]),
      [`POST /api/v1/adoption-requests/r-1/${action}`]: () => jsonResponse(200, item()),
    });
    const user = userEvent.setup();

    await user.click(within(await row()).getByRole('button', { name: new RegExp(`^${label}`) }));

    expect(await screen.findByText(done)).toBeInTheDocument();
  });

  it('explains why an approval fails when the animal is no longer available', async () => {
    renderPage({
      [LIST]: () => list([item()]),
      'POST /api/v1/adoption-requests/r-1/approve': () =>
        jsonResponse(409, {
          statusCode: 409,
          error: 'Conflict',
          message: 'x',
          code: 'ANIMAL_NOT_AVAILABLE',
        }),
    });
    const user = userEvent.setup();

    await user.click(within(await row()).getByRole('button', { name: /^Aprobar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se puede aprobar: el animal ya no está disponible.',
    );
  });

  it('says the request changed meanwhile on a 409 without code', async () => {
    renderPage({
      [LIST]: () => list([item()]),
      'POST /api/v1/adoption-requests/r-1/reject': () =>
        jsonResponse(409, { statusCode: 409, error: 'Conflict', message: 'x' }),
    });
    const user = userEvent.setup();

    await user.click(within(await row()).getByRole('button', { name: /^Rechazar/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esta solicitud ha cambiado mientras tanto.',
    );
  });

  it('filters by status through the URL', async () => {
    const { fetchMock } = renderPage({ [LIST]: () => list([item()]) });
    const user = userEvent.setup();
    await row();

    await user.selectOptions(screen.getByLabelText('Estado'), 'Aprobada');

    await waitFor(() =>
      expect(listUrls(fetchMock).at(-1)!.searchParams.get('status')).toBe('APPROVED'),
    );
  });

  it('shows only the requests of one animal when the URL names it, with a way back to all', async () => {
    const { fetchMock } = renderPage(
      { [LIST]: () => list([item()]) },
      { path: `/admin/adoption-requests?animalId=${LUNA_ID}` },
    );
    const user = userEvent.setup();
    await row();

    expect(listUrls(fetchMock)[0]!.searchParams.get('animalId')).toBe(LUNA_ID);
    expect(screen.getByText('Solo se muestran las solicitudes de un animal.')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Ver todas las solicitudes' }));

    await waitFor(() =>
      expect(listUrls(fetchMock).at(-1)!.searchParams.has('animalId')).toBe(false),
    );
  });

  it('paginates', async () => {
    const { fetchMock } = renderPage({
      [LIST]: (url) =>
        list([item({ id: `r-${url.searchParams.get('page') ?? '1'}` })], { total: 13 }),
    });
    const user = userEvent.setup();
    await row();

    expect(screen.getByText('Página 1 de 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));

    await waitFor(() => expect(listUrls(fetchMock).at(-1)!.searchParams.get('page')).toBe('2'));
  });

  it('shows an empty state and a load error', async () => {
    const { unmount } = renderPage({ [LIST]: () => list([]) });
    expect(await screen.findByText('No hay solicitudes con estos filtros.')).toBeInTheDocument();
    unmount();

    renderPage({
      [LIST]: () =>
        jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hemos podido cargar las solicitudes.',
    );
  });

  it('is for ADMINs only: a USER goes to the catalogue and a visitor to the login', async () => {
    const { fetchMock, unmount } = renderPage(
      {
        'GET /api/v1/animals': () =>
          jsonResponse(200, { items: [], page: 1, pageSize: 12, total: 0 }),
      },
      { role: 'USER' },
    );
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Animales en adopción' }),
    ).toBeInTheDocument();
    expect(listUrls(fetchMock)).toHaveLength(0);
    unmount();

    renderPage({}, { role: null });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });
});

describe('Header link (SCRUM-15)', () => {
  it('shows "Solicitudes" to an ADMIN only', async () => {
    const empty = () => list([]);
    const { unmount } = renderPage({ [LIST]: empty });
    expect(await screen.findByRole('link', { name: 'Solicitudes' })).toHaveAttribute(
      'href',
      '/admin/adoption-requests',
    );
    unmount();

    renderPage(
      {
        'GET /api/v1/animals': () =>
          jsonResponse(200, { items: [], page: 1, pageSize: 12, total: 0 }),
      },
      { role: 'USER', path: '/animals' },
    );
    await screen.findByText(/Hola, Ana/);
    expect(screen.queryByRole('link', { name: 'Solicitudes' })).not.toBeInTheDocument();
  });
});
