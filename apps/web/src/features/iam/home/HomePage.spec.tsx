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

  describe('for a signed-in USER', () => {
    it('greets them by name with the two actions and the animals', async () => {
      const { container } = renderHome('USER');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(screen.getByText('¿Qué te apetece hacer hoy?')).toBeInTheDocument();
      expect(main().getByRole('link', { name: 'Ver animales' })).toHaveAttribute(
        'href',
        '/animals',
      );
      expect(main().getByRole('link', { name: 'Encuentra tu compañero' })).toBeInTheDocument();
      expect(
        await screen.findByRole('heading', { level: 2, name: 'Algunos de nuestros amigos' }),
      ).toBeInTheDocument();
      expect(screen.queryByText('Has iniciado sesión.')).not.toBeInTheDocument();
      expect(screen.queryByText('Cómo funciona')).not.toBeInTheDocument();
      await expectNoAxeViolations(container, { page: true });
    });
  });

  describe('for an ADMIN', () => {
    it('greets them with "Ir al panel" and "Ver animales" only', async () => {
      renderHome('ADMIN');

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(main().getByRole('link', { name: 'Ir al panel' })).toHaveAttribute('href', '/admin');
      expect(main().getByRole('link', { name: 'Ver animales' })).toHaveAttribute(
        'href',
        '/animals',
      );
      expect(screen.queryByText('Cómo funciona')).not.toBeInTheDocument();
      expect(screen.queryByText('Algunos de nuestros amigos')).not.toBeInTheDocument();
    });
  });
});
