import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRoutes } from '../../../app/AppRoutes';
import { fakeApi, LUNA_ID, page, signedInAs, summary } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

function renderCatalogue(fetchMock: typeof fetch, path = '/animals') {
  return renderWithProviders(<AppRoutes />, { initialEntries: [path], fetch: fetchMock });
}

const group = (name: string) => within(screen.getByRole('group', { name }));
const search = () => userEvent.click(screen.getByRole('button', { name: 'Buscar' }));

/** Records the query of every catalogue request and answers with `respond`. */
function catalogueApi(
  respond: (query: URLSearchParams) => Response = () => jsonResponse(200, page([summary()])),
) {
  const queries: string[] = [];
  const fetchMock = fakeApi({
    'GET /api/v1/animals': (url) => {
      queries.push(url.searchParams.toString());
      return respond(url.searchParams);
    },
  });
  return { fetchMock, queries };
}

describe('CataloguePage (/animals, SCRUM-12)', () => {
  it('shows AVAILABLE animals as cards to a visitor, with a link to each detail (scenario 1)', async () => {
    const { fetchMock } = catalogueApi();
    renderCatalogue(fetchMock);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Animales en adopción' }),
    ).toBeInTheDocument();
    const card = (await screen.findByRole('heading', { level: 2, name: 'Luna' })).closest('li')!;
    expect(within(card).getByRole('img', { name: 'Luna' })).toHaveAttribute(
      'src',
      'https://images.example.com/luna.jpg',
    );
    for (const tag of ['Perro', 'Mediano', 'Adulto', 'Tranquilo', 'Bien con niños']) {
      expect(within(card).getByText(tag)).toBeInTheDocument();
    }
    // One stretched link per card, named after the animal (SCRUM-56).
    const links = within(card).getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAccessibleName('Luna');
    expect(links[0]).toHaveAttribute('href', `/animals/${LUNA_ID}`);
    expect(within(card).getByText('Conócelo')).toBeInTheDocument();
    expect(screen.getByText('1 animal')).toBeInTheDocument();
    await waitFor(() => expect(document.title).toBe('Animales en adopción · YouPetMe'));
  });

  it('has no accessibility violations', async () => {
    const { fetchMock } = catalogueApi();
    const { container } = renderCatalogue(fetchMock);
    await screen.findByRole('heading', { level: 2, name: 'Luna' });

    await expectNoAxeViolations(container, { page: true });
  });

  describe('filters (scenario 2): applied with "Buscar", sent to the API and kept in the URL', () => {
    it.each([
      ['Especie', 'Gato', 'species=CAT'],
      ['Tamaño', 'Grande', 'size=LARGE'],
      ['Edad', 'Senior', 'ageGroup=SENIOR'],
    ])('filters by %s', async (label, option, expected) => {
      const { fetchMock, queries } = catalogueApi();
      renderCatalogue(fetchMock);
      await screen.findByRole('heading', { level: 2, name: 'Luna' });

      await userEvent.click(group(label).getByRole('radio', { name: option }));
      await search();

      await waitFor(() => expect(queries.at(-1)).toBe(expected));
    });

    it('does not filter until "Buscar" is pressed', async () => {
      const { fetchMock, queries } = catalogueApi();
      renderCatalogue(fetchMock);
      await screen.findByRole('heading', { level: 2, name: 'Luna' });

      await userEvent.click(group('Especie').getByRole('radio', { name: 'Gato' }));
      await userEvent.click(screen.getByRole('checkbox', { name: 'Bien con niños' }));

      expect(queries).toEqual(['']);
      await search();
      await waitFor(() => expect(queries.at(-1)).toBe('species=CAT&compatibleWithChildren=true'));
    });

    it.each([
      ['Bien con niños', 'compatibleWithChildren=true'],
      ['Bien con otros animales', 'compatibleWithOtherAnimals=true'],
    ])('filters by the "%s" checkbox', async (label, expected) => {
      const { fetchMock, queries } = catalogueApi();
      renderCatalogue(fetchMock);
      await screen.findByRole('heading', { level: 2, name: 'Luna' });

      await userEvent.click(screen.getByRole('checkbox', { name: label }));
      await search();

      await waitFor(() => expect(queries.at(-1)).toBe(expected));
    });

    it('reads the filters from the URL and combines them', async () => {
      const { fetchMock, queries } = catalogueApi();
      renderCatalogue(fetchMock, '/animals?species=DOG&compatibleWithChildren=true');

      await screen.findByRole('heading', { level: 2, name: 'Luna' });

      expect(queries).toEqual(['species=DOG&compatibleWithChildren=true']);
      expect(group('Especie').getByRole('radio', { name: 'Perro' })).toBeChecked();
      expect(group('Tamaño').getByRole('radio', { name: 'Todos' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Bien con niños' })).toBeChecked();
    });
  });

  it('shows an actionable empty state that clears the filters (scenario 3)', async () => {
    const { fetchMock, queries } = catalogueApi((query) =>
      jsonResponse(200, page(query.size > 0 ? [] : [summary()])),
    );
    renderCatalogue(fetchMock, '/animals?species=CAT');

    const empty = await screen.findByRole('heading', {
      level: 2,
      name: 'Ningún animal encaja con tu búsqueda',
    });
    await userEvent.click(
      within(empty.closest('section')!).getByRole('button', { name: 'Quitar filtros' }),
    );

    expect(await screen.findByRole('heading', { level: 2, name: 'Luna' })).toBeInTheDocument();
    expect(queries.at(-1)).toBe('');
  });

  it('says there are no animals yet, never "no match", when no filter is applied', async () => {
    const { fetchMock } = catalogueApi(() => jsonResponse(200, page([])));
    renderCatalogue(fetchMock);

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Todavía no hay animales publicados' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Ningún animal encaja con tu búsqueda')).not.toBeInTheDocument();
  });

  it('offers no "Registrar animal" entry in the catalogue, not even to an ADMIN', async () => {
    const fetchMock = fakeApi(
      { 'GET /api/v1/animals': () => jsonResponse(200, page([summary()])) },
      signedInAs('ADMIN'),
    );
    renderWithProviders(<AppRoutes />, {
      initialEntries: ['/animals'],
      fetch: fetchMock,
      auth: 'restore',
    });

    await screen.findByRole('heading', { level: 2, name: 'Luna' });
    expect(screen.queryByRole('link', { name: 'Registrar animal' })).not.toBeInTheDocument();
  });

  it('moves between pages', async () => {
    const { fetchMock, queries } = catalogueApi((query) =>
      jsonResponse(200, page([summary()], { page: Number(query.get('page') ?? 1), total: 30 })),
    );
    renderCatalogue(fetchMock);
    await screen.findByText('Página 1 de 3');

    await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(await screen.findByText('Página 2 de 3')).toBeInTheDocument();
    expect(queries.at(-1)).toBe('page=2');
  });

  it('shows an error message when the catalogue cannot be loaded', async () => {
    const { fetchMock } = catalogueApi(() =>
      jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
    );
    renderCatalogue(fetchMock);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hemos podido cargar los animales.',
    );
  });
});
