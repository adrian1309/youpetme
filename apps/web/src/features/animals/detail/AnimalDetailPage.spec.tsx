import { screen, waitFor } from '@testing-library/react';

import { AppRoutes } from '../../../app/AppRoutes';
import { detail, fakeApi, LUNA_ID } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

function renderDetail(response: () => Response, id = LUNA_ID) {
  const fetchMock = fakeApi({ [`GET /api/v1/animals/${id}`]: response });
  return renderWithProviders(<AppRoutes />, {
    initialEntries: [`/animals/${id}`],
    fetch: fetchMock,
  });
}

const found =
  (overrides = {}) =>
  () =>
    jsonResponse(200, detail(overrides));

describe('AnimalDetailPage (/animals/:id, SCRUM-13)', () => {
  it('shows a visitor the full detail of an AVAILABLE animal (scenario 1)', async () => {
    renderDetail(found());

    expect(await screen.findByRole('heading', { level: 1, name: 'Luna' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto 1 de Luna' })).toHaveAttribute(
      'src',
      'https://images.example.com/luna.jpg',
    );
    for (const text of [
      'Perro',
      'Mediano',
      'Adulto',
      'Labrador',
      'Tranquilo',
      'Cariñoso',
      'Bien con niños',
      'Mejor sin otros animales',
      'Necesita un jardín.',
    ]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.queryByText(/ya no está disponible/)).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toHaveAttribute(
      'href',
      '/animals',
    );
    await waitFor(() => expect(document.title).toBe('Luna · YouPetMe'));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderDetail(found());
    await screen.findByRole('heading', { level: 1, name: 'Luna' });

    await expectNoAxeViolations(container, { page: true });
  });

  it('says unknown compatibility explicitly instead of hiding it', async () => {
    renderDetail(found({ compatibleWithChildren: null, compatibleWithOtherAnimals: null }));

    expect(await screen.findByText('Con niños: no se sabe')).toBeInTheDocument();
    expect(screen.getByText('Con otros animales: no se sabe')).toBeInTheDocument();
  });

  it.each([
    ['RESERVED', 'Reservado'],
    ['ADOPTED', 'Adoptado'],
  ])('clearly marks a %s animal as not available (scenario 2)', async (status, label) => {
    renderDetail(found({ status }));

    expect(
      await screen.findByText(`Este animal ya no está disponible para adopción (${label}).`),
    ).toBeInTheDocument();
  });

  it('shows a clear not-found state, not a blank page (scenario 3)', async () => {
    renderDetail(() =>
      jsonResponse(404, { statusCode: 404, error: 'Not Found', message: 'Animal not found' }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Este animal no existe' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver al catálogo' })).toBeInTheDocument();
  });

  it('shows an error message when the detail cannot be loaded', async () => {
    renderDetail(() =>
      jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('No hemos podido cargar la ficha.');
  });
});
