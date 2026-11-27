import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '../features/iam/auth/auth-state';
import { ApiError } from '../lib/http/api-error';
import { expectNoAxeViolations } from '../test/axe';
import { jsonResponse, renderWithProviders } from '../test/render-with-providers';
import { AppRoutes } from './AppRoutes';
import { DIANGO_WELCOME_SEEN_KEY } from '../lib/storage/diango-welcome';

const session = {
  accessToken: 'access-token-value',
  user: {
    id: 'u-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    role: 'USER' as const,
    hasSeenWelcome: true,
  },
};

function SignedIn({ children }: { children: ReactNode }) {
  const { signIn, isAuthenticated } = useAuth();
  useEffect(() => signIn(session), [signIn]);
  return isAuthenticated ? children : null;
}

describe('AppRoutes', () => {
  describe('/ for a visitor', () => {
    it('shows the brand and a way to create an account', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      expect(
        screen.getByRole('heading', { level: 1, name: '¿Listo para encontrar a tu mejor amigo?' }),
      ).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Registrarse' })).toHaveAttribute(
        'href',
        '/register',
      );
      expect(screen.getByRole('link', { name: 'Inicia sesión' })).toHaveAttribute('href', '/login');
    });

    it('has a header, a main landmark and a skip link as the first stop', async () => {
      // A returning visitor: on a first visit Diango's welcome takes the focus (SCRUM-17).
      window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');
      const user = userEvent.setup();
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.getByRole('main')).toBeInTheDocument();
      await user.tab();
      const skip = screen.getByRole('link', { name: 'Saltar al contenido' });
      expect(skip).toHaveFocus();
      expect(skip).toHaveAttribute('href', '#main');
      await user.keyboard('{Enter}');
      expect(screen.getByRole('main')).toHaveAttribute('id', 'main');
      window.localStorage.clear();
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      await expectNoAxeViolations(container, { page: true });
    });

    it('sets the document title', async () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      await waitFor(() => expect(document.title).toBe('YouPetMe'));
    });
  });

  describe('/ once authenticated', () => {
    it('greets the user by name in a minimal header, with a logout action and no profile entry yet', () => {
      renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/'] },
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveTextContent('YouPetMe');
      expect(header).toHaveTextContent('Hola, John');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Hola, John');
      expect(screen.queryByRole('link', { name: /perfil/i })).not.toBeInTheDocument();
      expect(within(header).getByRole('button', { name: 'Cerrar sesión' })).toBeVisible();
      expect(screen.queryByRole('link', { name: 'Registrarse' })).not.toBeInTheDocument();
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/'] },
      );

      await expectNoAxeViolations(container, { page: true });
    });

    it('sends someone who is already signed in away from /register', async () => {
      renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/register'] },
      );

      expect(await screen.findByRole('heading', { level: 1, name: /^Hola, / })).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });
  });

  describe('/register', () => {
    it('shows the form inside the page layout and sets its title', async () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/register'] });

      expect(screen.getByRole('main')).toContainElement(screen.getByRole('form'));
      await waitFor(() => expect(document.title).toBe('Crea tu cuenta · YouPetMe'));
    });

    it('registers, lands on the authenticated home and greets the new user', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AppRoutes />, {
        initialEntries: ['/register'],
        fetch: vi.fn().mockResolvedValue(
          jsonResponse(201, {
            user: {
              id: 'u-1',
              firstName: 'Ana',
              lastName: 'Ruiz',
              email: 'ana@example.com',
              status: 'ACTIVE',
            },
            authentication: { accessToken: 'access-token-value' },
          }),
        ),
      });

      await user.type(screen.getByLabelText('Nombre', { selector: 'input' }), 'Ana');
      await user.type(screen.getByLabelText('Apellidos', { selector: 'input' }), 'Ruiz');
      await user.type(
        screen.getByLabelText('Correo electrónico', { selector: 'input' }),
        'ana@example.com',
      );
      await user.type(
        screen.getByLabelText('Contraseña', { selector: 'input' }),
        'my-secure-passphrase',
      );
      await user.type(
        screen.getByLabelText('Confirmar contraseña', { selector: 'input' }),
        'my-secure-passphrase',
      );
      await user.click(screen.getByRole('checkbox', { name: /Acepto los/ }));
      await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Hola, Ana' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Tu cuenta está creada.')).toBeInTheDocument();
      expect(window.localStorage.length).toBe(0);
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, { initialEntries: ['/register'] });

      await expectNoAxeViolations(container, { page: true });
    });
  });

  describe.each([
    ['/terms', 'Términos de Servicio'],
    ['/privacy', 'Política de Privacidad'],
  ])('%s (SCRUM-47)', (path, title) => {
    const versionFetch = () => vi.fn().mockResolvedValue(jsonResponse(200, { version: '2026-01' }));

    it('shows the real page with the server version, not the provisional one', async () => {
      renderWithProviders(<AppRoutes />, { initialEntries: [path], fetch: versionFetch() });

      expect(screen.getByRole('main')).toContainElement(
        screen.getByRole('heading', { level: 1, name: title }),
      );
      expect(await screen.findByText('Versión vigente: 2026-01')).toBeInTheDocument();
      expect(screen.queryByText('Esta página estará disponible pronto.')).not.toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe(`${title} · YouPetMe`));
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, {
        initialEntries: [path],
        fetch: versionFetch(),
      });
      await screen.findByText('Versión vigente: 2026-01');

      await expectNoAxeViolations(container, { page: true });
    });

    it('has no accessibility violations as a whole page when the version cannot be loaded', async () => {
      const { container } = renderWithProviders(<AppRoutes />, {
        initialEntries: [path],
        fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      });
      await screen.findByText(/No hemos podido cargar la versión vigente/);

      await expectNoAxeViolations(container, { page: true });
    });
  });

  describe('password recovery (TS-IAM-004)', () => {
    it.each([
      ['/forgot-password', 'Recupera tu contraseña'],
      ['/reset-password?token=some-token', 'Crea una contraseña nueva'],
    ])('%s shows its form inside the page layout', (path, title) => {
      renderWithProviders(<AppRoutes />, { initialEntries: [path] });

      expect(screen.getByRole('main')).toContainElement(
        screen.getByRole('heading', { level: 1, name: title }),
      );
      expect(screen.getByRole('main')).toContainElement(screen.getByRole('form'));
    });
  });

  describe('unknown addresses', () => {
    it.each(['/nope', '/register/extra', '/terms/old'])(
      '%s shows a not-found page with a way back, inside the layout',
      async (path) => {
        renderWithProviders(<AppRoutes />, { initialEntries: [path] });

        expect(screen.getByRole('banner')).toBeInTheDocument();
        expect(screen.getByRole('main')).toContainElement(
          screen.getByRole('heading', { level: 1, name: 'Página no encontrada' }),
        );
        expect(
          screen.getByText(
            'No hemos encontrado la página que buscas. Revisa la dirección o vuelve al inicio.',
          ),
        ).toBeVisible();
        expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
        await waitFor(() => expect(document.title).toBe('Página no encontrada · YouPetMe'));
      },
    );

    it('does not use the "coming soon" text of the provisional pages', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/nope'] });

      expect(screen.queryByText('Esta página estará disponible pronto.')).not.toBeInTheDocument();
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, { initialEntries: ['/nope'] });

      await expectNoAxeViolations(container, { page: true });
    });
  });

  describe('logout (US-IAM-003)', () => {
    const loggedOut = () => Promise.resolve(new Response(null, { status: 204 }));

    /** Signs in once and keeps rendering after the logout, unlike SignedIn. */
    function SignedInOnce({ children }: { children: ReactNode }) {
      const { signIn } = useAuth();
      useEffect(() => signIn(session), [signIn]);
      return children;
    }

    function logoutButton() {
      return within(screen.getByRole('banner')).getByRole('button', { name: 'Cerrar sesión' });
    }

    async function expectPublicHome() {
      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: '¿Listo para encontrar a tu mejor amigo?',
        }),
      ).toBeInTheDocument();
      expect(screen.getByRole('banner')).not.toHaveTextContent('Hola');
      expect(screen.getByRole('link', { name: 'Inicia sesión' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    }

    it('Scenario 1: from any view, "Cerrar sesión" calls the API and lands on the public home', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn<typeof fetch>(loggedOut);
      renderWithProviders(
        <SignedInOnce>
          <AppRoutes />
        </SignedInOnce>,
        { initialEntries: ['/terms'], fetch: fetchMock },
      );

      await user.click(logoutButton());

      await expectPublicHome();
      // /terms also asks for the terms version; find the logout among the calls.
      const logoutCall = fetchMock.mock.calls.find(
        ([url]) => url === 'http://api.test/api/v1/auth/logout',
      );
      expect(logoutCall).toBeDefined();
      expect(new Headers(logoutCall![1]!.headers).get('Authorization')).toBe(
        'Bearer access-token-value',
      );
    });

    it('Scenario 1: shows that the logout is in progress and sends it only once', async () => {
      const user = userEvent.setup();
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn<typeof fetch>(
        () => new Promise<Response>((resolve) => (answer = resolve)),
      );
      renderWithProviders(
        <SignedInOnce>
          <AppRoutes />
        </SignedInOnce>,
        { initialEntries: ['/'], fetch: fetchMock },
      );

      await user.click(logoutButton());
      const pending = within(screen.getByRole('banner')).getByRole('button', {
        name: 'Cerrando sesión…',
      });
      expect(pending).toHaveAttribute('aria-disabled', 'true');
      await user.click(pending);

      // The home also asks for a few animals (SCRUM-56): count the logout calls only.
      const logouts = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/logout'));
      expect(logouts).toHaveLength(1);
      answer(new Response(null, { status: 204 }));
      await expectPublicHome();
    });

    it('Scenario 3: when the network fails, the user is signed out anyway', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SignedInOnce>
          <AppRoutes />
        </SignedInOnce>,
        {
          initialEntries: ['/'],
          fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
        },
      );

      await user.click(logoutButton());

      await expectPublicHome();
    });

    it('a visitor sees no logout action', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).not.toBeInTheDocument();
    });
  });

  describe('session restoration on start-up (US-IAM-002, scenarios 5 and 6)', () => {
    const refreshed = {
      user: {
        id: 'u-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        role: 'USER' as const,
      },
      authentication: { accessToken: 'restored-token' },
    };

    it('shows an accessible loading state instead of the page while the session is restored', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
      renderWithProviders(<AppRoutes />, {
        initialEntries: ['/'],
        auth: 'restore',
        fetch: fetchMock,
      });

      expect(screen.getByRole('status')).toHaveTextContent('Recuperando tu sesión…');
      expect(screen.getByRole('banner')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument();

      answer(jsonResponse(200, { ...refreshed, user: { ...refreshed.user, status: 'ACTIVE' } }));

      expect(await screen.findByRole('heading', { level: 1, name: /^Hola, / })).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveTextContent('Hola, John');
      expect(screen.queryByText('Recuperando tu sesión…')).not.toBeInTheDocument();
    });

    it('a reload on /login with a valid session goes straight to the home, never showing the form', async () => {
      renderWithProviders(<AppRoutes />, {
        initialEntries: ['/login'],
        auth: 'restore',
        fetch: vi.fn().mockResolvedValue(jsonResponse(200, refreshed)),
      });

      expect(await screen.findByRole('heading', { level: 1, name: /^Hola, / })).toBeInTheDocument();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('without a renewable session the visitor sees the page and no error', async () => {
      renderWithProviders(<AppRoutes />, {
        initialEntries: ['/'],
        auth: 'restore',
        fetch: vi
          .fn()
          .mockResolvedValue(jsonResponse(401, { statusCode: 401, error: 'x', message: 'x' })),
      });

      expect(
        await screen.findByRole('heading', {
          level: 1,
          name: '¿Listo para encontrar a tu mejor amigo?',
        }),
      ).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });
  });

  describe('a session lost while in use (US-IAM-002, scenario 6)', () => {
    function ProtectedAction() {
      const { authorized } = useAuth();
      return (
        <button
          type="button"
          onClick={() => void authorized(() => Promise.reject(new ApiError(401))).catch(() => {})}
        >
          acción protegida
        </button>
      );
    }

    /** Signs in once and keeps rendering after the session ends, unlike SignedIn. */
    function SignInOnce({ children }: { children: ReactNode }) {
      const { signIn } = useAuth();
      useEffect(() => signIn(session), [signIn]);
      return children;
    }

    it('sends the user to /login when the session can no longer be renewed', async () => {
      const user = userEvent.setup();
      renderWithProviders(
        <SignInOnce>
          <ProtectedAction />
          <AppRoutes />
        </SignInOnce>,
        {
          initialEntries: ['/'],
          fetch: vi
            .fn()
            .mockResolvedValue(jsonResponse(401, { statusCode: 401, error: 'x', message: 'x' })),
        },
      );

      await user.click(screen.getByRole('button', { name: 'acción protegida' }));

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Iniciar sesión' }),
      ).toBeInTheDocument();
    });
  });

  describe('catalogue links (SCRUM-12)', () => {
    it('offers the catalogue from the home and the header to a visitor', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      expect(
        within(screen.getByRole('main')).getAllByRole('link', { name: 'Ver animales' })[0],
      ).toHaveAttribute('href', '/animals');
      expect(
        within(screen.getByRole('banner')).getByRole('link', { name: 'Animales' }),
      ).toHaveAttribute('href', '/animals');
    });

    it('offers the catalogue from the home and the header once signed in', async () => {
      renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/'] },
      );

      expect(
        (await within(screen.getByRole('main')).findAllByRole('link', { name: 'Ver animales' }))[0],
      ).toHaveAttribute('href', '/animals');
      expect(
        within(screen.getByRole('banner')).getByRole('link', { name: 'Animales' }),
      ).toHaveAttribute('href', '/animals');
    });
  });

  describe('header and footer (SCRUM-56)', () => {
    it('offers "Entrar" and "Registrarse" to a visitor in the header', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });
      const header = screen.getByRole('banner');

      expect(within(header).getByRole('link', { name: 'YouPetMe' })).toHaveAttribute('href', '/');
      expect(within(header).getByRole('link', { name: 'Entrar' })).toHaveAttribute(
        'href',
        '/login',
      );
      expect(within(header).getByRole('link', { name: 'Registrarse' })).toHaveAttribute(
        'href',
        '/register',
      );
    });

    it('marks the navigation link of the current route with aria-current', async () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/matching'] });
      const nav = within(screen.getByRole('navigation', { name: 'Navegación principal' }));

      expect(await nav.findByRole('link', { name: 'Encuentra tu compañero' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(nav.getByRole('link', { name: 'Animales' })).not.toHaveAttribute('aria-current');
    });

    it('has a menu button that says whether the navigation is expanded', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      const menu = within(screen.getByRole('banner')).getByRole('button', { name: 'Menú' });
      expect(menu).toHaveAttribute('aria-expanded', 'false');
      await user.click(menu);
      expect(menu).toHaveAttribute('aria-expanded', 'true');
      await user.click(menu);
      expect(menu).toHaveAttribute('aria-expanded', 'false');
    });

    it('shows the signed-in user an avatar with their initial and no sign-in links', () => {
      renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/'] },
      );
      const header = within(screen.getByRole('banner'));

      expect(header.getByText('J')).toBeInTheDocument();
      expect(header.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument();
      expect(header.queryByRole('link', { name: 'Registrarse' })).not.toBeInTheDocument();
    });

    it('has a simple footer with the brand and a tagline', () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      const footer = screen.getByRole('contentinfo');
      expect(footer).toHaveTextContent('YouPetMe');
      expect(footer).toHaveTextContent('Cada animal merece un hogar');
    });
  });

  describe('AI Matching (SCRUM-16)', () => {
    it('links to the public matching page from the header, which is accessible', async () => {
      const { container } = renderWithProviders(<AppRoutes />, { initialEntries: ['/'] });

      const link = within(screen.getByRole('banner')).getByRole('link', {
        name: 'Encuentra tu compañero',
      });
      expect(link).toHaveAttribute('href', '/matching');

      await userEvent.setup().click(link);

      expect(
        await screen.findByRole('heading', { level: 1, name: 'Cuéntale a Diango cómo eres' }),
      ).toBeInTheDocument();
      await expectNoAxeViolations(container, { page: true });
    });
  });
});
