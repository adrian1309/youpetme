import type { MatchingResponse, RefreshResponse } from '@youpetme/contracts';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { MATCHING_PROFILE_KEY } from '../../lib/storage/matching-profile';
import { summary } from '../../test/animals';
import { expectNoAxeViolations } from '../../test/axe';
import { jsonResponse, renderWithProviders, TEST_API_URL } from '../../test/render-with-providers';
import { MATCHING_PATH } from './matching-api';
import { MatchingPage } from './MatchingPage';

type Call = { url: string; body: unknown; authorization: string | null };

const MATCH: MatchingResponse = {
  profile: { preferredSpecies: 'DOG', housingSize: 'SMALL' },
  results: [
    {
      animal: summary({ name: 'Toby', size: 'SMALL' }),
      score: 3,
      reasons: ['SPECIES_MATCH', 'SIZE_FITS_HOME'],
    },
  ],
};

const SESSION: RefreshResponse = {
  user: {
    id: 'u-1',
    firstName: 'Ana',
    lastName: 'Ruiz',
    email: 'ana@example.com',
    status: 'ACTIVE',
    role: 'USER',
    hasSeenWelcome: true,
  },
  authentication: { accessToken: 'access-token' },
};

function fakeApi(options: { replies?: Response[]; session?: RefreshResponse } = {}) {
  const calls: Call[] = [];
  const replies = [...(options.replies ?? [])];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(TEST_API_URL, '');
    if (url === '/api/v1/auth/refresh') {
      return options.session ? jsonResponse(200, options.session) : jsonResponse(401, {});
    }
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: new Headers(init?.headers).get('Authorization'),
    });
    if (url === MATCHING_PATH) return replies.shift() ?? jsonResponse(503, {});
    return jsonResponse(404, {});
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const descriptionField = () => screen.getByRole('textbox', { name: /cuéntanos/i });
const submitButton = () => screen.getByRole('button', { name: /buscar compañero/i });

async function describe_(text: string) {
  const user = userEvent.setup();
  await user.type(descriptionField(), text);
  await user.click(submitButton());
  return user;
}

describe('MatchingPage (SCRUM-16)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('offers tips, counts characters and is accessible', async () => {
    const { container } = renderWithProviders(<MatchingPage />, { fetch: fakeApi().fetch });

    expect(
      screen.getByRole('heading', { level: 1, name: /encuentra tu compañero/i }),
    ).toBeVisible();
    expect(screen.getByText(/tu vivienda/i)).toBeVisible();
    expect(screen.getByText('0/1000')).toBeVisible();
    await userEvent.setup().type(descriptionField(), 'Hola');
    expect(screen.getByText('4/1000')).toBeVisible();
    expect(descriptionField()).toHaveAttribute('maxLength', '1000');
    await expectNoAxeViolations(container);
  });

  it('asks for a description instead of sending an empty one', async () => {
    const api = fakeApi();
    renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    await userEvent.setup().click(submitButton());

    expect(descriptionField()).toHaveAccessibleDescription(/escribe algo sobre ti/i);
    expect(api.calls).toEqual([]);
  });

  it('shows the recommended animals with their fit and reasons, linking to the detail', async () => {
    const api = fakeApi({ replies: [jsonResponse(200, MATCH)] });
    const { container } = renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    await describe_('Vivo en un piso y quiero un perro');

    const card = (await screen.findByRole('heading', { name: 'Toby' })).closest('li')!;
    expect(within(card).getByText('Encaja bien')).toBeVisible();
    const reasons = within(card).getByRole('list', { name: /por qué encaja/i });
    expect(
      within(reasons)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Es de la especie que buscas', 'Su tamaño encaja con tu vivienda']);
    expect(within(card).getByRole('link', { name: /ver ficha de toby/i })).toHaveAttribute(
      'href',
      `/animals/${MATCH.results[0]!.animal.id}`,
    );
    expect(api.calls).toEqual([
      {
        url: MATCHING_PATH,
        body: { description: 'Vivo en un piso y quiero un perro' },
        authorization: null,
      },
    ]);
    await expectNoAxeViolations(container);
  });

  it('labels a high score as a very good fit', async () => {
    const api = fakeApi({
      replies: [jsonResponse(200, { ...MATCH, results: [{ ...MATCH.results[0]!, score: 5 }] })],
    });
    renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    await describe_('Busco un perro');

    expect(await screen.findByText('Encaja muy bien')).toBeVisible();
  });

  it('keeps a guest profile in localStorage', async () => {
    const api = fakeApi({ replies: [jsonResponse(200, MATCH)] });
    renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    await describe_('Busco un perro');
    await screen.findByRole('heading', { name: 'Toby' });

    expect(JSON.parse(window.localStorage.getItem(MATCHING_PROFILE_KEY)!)).toEqual(MATCH.profile);
  });

  it('sends the Bearer for a signed-in user and keeps nothing in localStorage', async () => {
    const api = fakeApi({ replies: [jsonResponse(200, MATCH)], session: SESSION });
    renderWithProviders(<MatchingPage />, { fetch: api.fetch, auth: 'restore' });

    await describe_('Busco un perro');
    await screen.findByRole('heading', { name: 'Toby' });

    expect(api.calls[0]?.authorization).toBe('Bearer access-token');
    expect(window.localStorage.getItem(MATCHING_PROFILE_KEY)).toBeNull();
  });

  it('shows an actionable empty state linking to the whole catalogue', async () => {
    const api = fakeApi({ replies: [jsonResponse(200, { profile: {}, results: [] })] });
    const { container } = renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    await describe_('Busco un dragón');

    expect(await screen.findByRole('heading', { name: /no hemos encontrado/i })).toBeVisible();
    expect(screen.getByRole('link', { name: /ver todos los animales/i })).toHaveAttribute(
      'href',
      '/animals',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it.each([
    [429, /muchas búsquedas seguidas/i],
    [503, /no está disponible ahora/i],
  ])('explains a %s and retries the same description', async (status, message) => {
    const api = fakeApi({
      replies: [jsonResponse(status, { statusCode: status }), jsonResponse(200, MATCH)],
    });
    const { container } = renderWithProviders(<MatchingPage />, { fetch: api.fetch });

    const user = await describe_('Busco un perro');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(message);
    await expectNoAxeViolations(container);

    await user.click(within(alert).getByRole('button', { name: /reintentar/i }));

    expect(await screen.findByRole('heading', { name: 'Toby' })).toBeVisible();
    expect(api.calls.map((call) => call.body)).toEqual([
      { description: 'Busco un perro' },
      { description: 'Busco un perro' },
    ]);
  });
});
