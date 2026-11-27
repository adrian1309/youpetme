import { screen, within } from '@testing-library/react';

import { AppRoutes } from '../../../app/AppRoutes';
import { fakeApi, page, signedInAs, summary } from '../../../test/animals';
import { expectNoAxeViolations } from '../../../test/axe';
import { jsonResponse, renderWithProviders } from '../../../test/render-with-providers';

const ANIMALS = 'GET /api/v1/animals';
const four = ['Luna', 'Toby', 'Coco', 'Misi'].map((name, index) =>
  summary({ id: `00000000-0000-4000-8000-00000000000${index}`, name }),
);

function renderHome(
  role: 'USER' | 'ADMIN' | null,
  animals: () => Response = () => jsonResponse(200, page(four)),
) {
  const fetchMock = fakeApi({ [ANIMALS]: animals }, role ? signedInAs(role) : null);
  return renderWithProviders(<AppRoutes />, {
    initialEntries: ['/'],
    fetch: fetchMock,
    auth: 'restore',
  });
}

const main = () => within(screen.getByRole('main'));

describe('HomePage (/, SCRUM-56)', () => {
  describe('for a visitor', () => {
    it('invites them in with a hero, two big actions and a sign-in line', async () => {
      renderHome(null);

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: '¿Listo para encontrar a tu mejor amigo?',
        }),
      ).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      // The hero and the closing band repeat the same two actions.
      for (const link of main().getAllByRole('link', { name: 'Ver animales' })) {
        expect(link).toHaveAttribute('href', '/animals');
      }
      for (const link of main().getAllByRole('link', { name: 'Encuentra tu compañero' })) {
        expect(link).toHaveAttribute('href', '/matching');
      }
      expect(main().getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login');
    });

    it('explains how it works in three steps', async () => {
      renderHome(null);

      const how = (await screen.findByRole('heading', { level: 2, name: 'Cómo funciona' })).closest(
        'section',
      )!;
      expect(
        within(how)
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(['Descubre', 'Cuéntale a Diango', 'Adopta']);
    });

    it('shows up to three available animals and a link to all of them', async () => {
      renderHome(null);

      const friends = (
        await screen.findByRole('heading', { level: 2, name: 'Algunos de nuestros amigos' })
      ).closest('section')!;
      expect(
        within(friends)
          .getAllByRole('heading', { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(['Luna', 'Toby', 'Coco']);
      expect(within(friends).getByRole('link', { name: 'Ver todos los animales' })).toHaveAttribute(
        'href',
        '/animals',
      );
    });

    it.each([
      ['there are no animals', () => jsonResponse(200, page([]))],
      [
        'the request fails',
        () => jsonResponse(500, { statusCode: 500, error: 'Internal Server Error', message: 'x' }),
      ],
    ])('hides the animals section, without an error, when %s', async (_case, animals) => {
      renderHome(null, animals);

      await screen.findByRole('heading', { level: 2, name: 'Cómo funciona' });
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(screen.queryByText('Algunos de nuestros amigos')).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('has no accessibility violations', async () => {
      const { container } = renderHome(null);
      await screen.findByRole('heading', { level: 2, name: 'Algunos de nuestros amigos' });

      await expectNoAxeViolations(container, { page: true });
    });
  });

  /** Every section of the full home page, in order, with the right heading levels. */
  async function expectFullHome() {
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 2, name: 'Cómo funciona' })).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Algunos de nuestros amigos' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Tu nuevo mejor amigo está a un clic' }),
    ).toBeInTheDocument();
  }

  const hrefs = (name: string) =>
    main()
      .getAllByRole('link', { name })
      .map((link) => link.getAttribute('href'));

  describe('for a signed-in USER', () => {
    it('shows the full home page with a greeting and the two actions in the hero and the band', async () => {
      const { container } = renderHome('USER');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(screen.getByText('¿Qué te apetece hacer hoy?')).toBeInTheDocument();
      await expectFullHome();
      expect(hrefs('Ver animales')).toEqual(['/animals', '/animals']);
      expect(hrefs('Encuentra tu compañero')).toEqual(['/matching', '/matching']);
      expect(screen.queryByRole('link', { name: 'Inicia sesión' })).not.toBeInTheDocument();
      expect(screen.queryByText('Has iniciado sesión.')).not.toBeInTheDocument();
      await expectNoAxeViolations(container, { page: true });
    });
  });

  describe('for an ADMIN', () => {
    it('shows the full home page with "Ir al panel" and "Ver animales" in the hero and the band', async () => {
      const { container } = renderHome('ADMIN');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      await expectFullHome();
      expect(hrefs('Ir al panel')).toEqual(['/admin', '/admin']);
      expect(hrefs('Ver animales')).toEqual(['/animals', '/animals']);
      expect(
        main().queryByRole('link', { name: 'Encuentra tu compañero' }),
      ).not.toBeInTheDocument();
      await expectNoAxeViolations(container, { page: true });
    });
  });
});
