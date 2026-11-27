import { screen, within } from '@testing-library/react';

import { AppRoutes } from '../../app/AppRoutes';
import { fakeApi, signedInAs } from '../../test/animals';
import { expectNoAxeViolations } from '../../test/axe';
import { jsonResponse, renderWithProviders } from '../../test/render-with-providers';

const LIST = 'GET /api/v1/adoption-requests';

function renderPanel(role: 'USER' | 'ADMIN' | null, list = () => jsonResponse(200, pending(3))) {
  const queries: string[] = [];
  const fetchMock = fakeApi(
    {
      [LIST]: (url) => {
        queries.push(url.searchParams.toString());
        return list();
      },
      'GET /api/v1/animals': () =>
        jsonResponse(200, { items: [], page: 1, pageSize: 12, total: 0 }),
    },
    role ? signedInAs(role) : null,
  );
  const result = renderWithProviders(<AppRoutes />, {
    initialEntries: ['/admin'],
    fetch: fetchMock,
    auth: 'restore',
  });
  return { ...result, queries };
}

const pending = (total: number) => ({ items: [], page: 1, pageSize: 20, total });

describe('AdminPanelPage (/admin, SCRUM-56)', () => {
  it('offers an ADMIN the two entries, with the number of pending requests', async () => {
    const { queries } = renderPanel('ADMIN');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Panel de administración' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Registrar animal' })).toHaveAttribute(
      'href',
      '/admin/animals/new',
    );
    const requests = screen.getByRole('link', { name: 'Solicitudes de adopción' });
    expect(requests).toHaveAttribute('href', '/admin/adoption-requests');
    expect(await within(requests.closest('li')!).findByText('3 pendientes')).toBeInTheDocument();
    expect(queries).toEqual(['status=PENDING']);
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPanel('ADMIN');
    await screen.findByText('3 pendientes');

    await expectNoAxeViolations(container, { page: true });
  });

  it('still offers the requests when the count cannot be loaded', async () => {
    renderPanel('ADMIN', () =>
      jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
    );

    expect(
      await screen.findByText('Revisa y decide las solicitudes recibidas.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Solicitudes de adopción' })).toBeInTheDocument();
  });

  it('sends a USER to the catalogue', async () => {
    renderPanel('USER');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Animales en adopción' }),
    ).toBeInTheDocument();
  });

  it('sends a visitor to the login page', async () => {
    renderPanel(null);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' }),
    ).toBeInTheDocument();
  });
});
