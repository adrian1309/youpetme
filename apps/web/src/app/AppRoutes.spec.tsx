import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '../features/iam/auth/auth-state';
import { ApiError } from '../lib/http/api-error';
import { expectNoAxeViolations } from '../test/axe';
import { jsonResponse, renderWithProviders } from '../test/render-with-providers';
import { AppRoutes } from './AppRoutes';

const session = {
  accessToken: 'access-token-value',
  user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
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

      expect(screen.getByRole('heading', { level: 1, name: 'YouPetMe' })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute(
        'href',
        '/register',
      );
      expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/login',
      );
    });

    it('has a header, a main landmark and a skip link as the first stop', async () => {
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
    it('greets the user by name in a minimal header, with no profile or logout entries yet', () => {
      renderWithProviders(
        <SignedIn>
          <AppRoutes />
        </SignedIn>,
        { initialEntries: ['/'] },
      );

      const header = screen.getByRole('banner');
      expect(header).toHaveTextContent('YouPetMe');
      expect(header).toHaveTextContent('Hola, John');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Has iniciado sesión.');
      expect(screen.queryByRole('link', { name: /perfil/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /cerrar sesión/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Crear cuenta' })).not.toBeInTheDocument();
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

      expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
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

      expect(await screen.findByText('Hola, Ana')).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu cuenta está creada.');
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

  describe('provisional page that the password recovery story will replace', () => {
    it('/forgot-password shows a titled placeholder with a way back', async () => {
      renderWithProviders(<AppRoutes />, { initialEntries: ['/forgot-password'] });

      expect(
        screen.getByRole('heading', { level: 1, name: 'Recuperar contraseña' }),
      ).toBeInTheDocument();
      expect(screen.getByText('Esta página estará disponible pronto.')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
      await waitFor(() => expect(document.title).toBe('Recuperar contraseña · YouPetMe'));
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, {
        initialEntries: ['/forgot-password'],
      });

      await expectNoAxeViolations(container, { page: true });
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

  describe('session restoration on start-up (US-IAM-002, scenarios 5 and 6)', () => {
    const refreshed = {
      user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
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

      expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveTextContent('Hola, John');
      expect(screen.queryByText('Recuperando tu sesión…')).not.toBeInTheDocument();
    });

    it('a reload on /login with a valid session goes straight to the home, never showing the form', async () => {
      renderWithProviders(<AppRoutes />, {
        initialEntries: ['/login'],
        auth: 'restore',
        fetch: vi.fn().mockResolvedValue(jsonResponse(200, refreshed)),
      });

      expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
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
        await screen.findByRole('heading', { level: 1, name: 'YouPetMe' }),
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
});
