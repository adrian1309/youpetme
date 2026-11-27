import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
    const back = screen.getByRole('link', { name: 'Volver al catálogo' });
    expect(back).toHaveAttribute('href', '/animals');
    // At the top, before the name (SCRUM-56).
    expect(
      back.compareDocumentPosition(screen.getByRole('heading', { level: 1 })) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    await waitFor(() => expect(document.title).toBe('Luna · YouPetMe'));
  });

  it('puts the adoption card at the end, after compatibility and care notes', async () => {
    renderDetail(found());

    const adopt = await screen.findByRole('heading', { level: 2, name: '¿Te lo llevas a casa?' });
    const care = screen.getByRole('heading', { level: 2, name: 'Salud y cuidados' });
    const compatibility = screen.getByRole('heading', { level: 2, name: 'Convivencia' });
    expect(care.compareDocumentPosition(adopt) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      compatibility.compareDocumentPosition(adopt) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solicitar adopción' })).toBeInTheDocument();
  });

  it('switches the main photo with thumbnail buttons', async () => {
    const urls = ['https://images.example.com/1.jpg', 'https://images.example.com/2.jpg'];
    renderDetail(found({ photoUrls: urls }));

    const second = await screen.findByRole('button', { name: 'Ver foto 2 de Luna' });
    expect(screen.getByRole('button', { name: 'Ver foto 1 de Luna' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(second).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(second);

    expect(second).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('img', { name: 'Foto 2 de Luna' })).toHaveAttribute('src', urls[1]);
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
