import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';

import { useAuth } from '../features/iam/auth/auth-state';
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
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Tu cuenta está creada.');
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

      expect(await screen.findByText('Tu cuenta está creada.')).toBeInTheDocument();
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

  describe('provisional pages that SCRUM-47 and SCRUM-6 will replace', () => {
    it.each([
      ['/terms', 'Términos de Servicio'],
      ['/privacy', 'Política de Privacidad'],
      ['/login', 'Iniciar sesión'],
    ])('%s shows a titled placeholder with a way back', async (path, title) => {
      renderWithProviders(<AppRoutes />, { initialEntries: [path] });

      expect(screen.getByRole('heading', { level: 1, name: title })).toBeInTheDocument();
      expect(screen.getByText('Esta página estará disponible pronto.')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Volver al inicio' })).toHaveAttribute('href', '/');
      await waitFor(() => expect(document.title).toBe(`${title} · YouPetMe`));
    });

    it('has no accessibility violations as a whole page', async () => {
      const { container } = renderWithProviders(<AppRoutes />, { initialEntries: ['/terms'] });

      await expectNoAxeViolations(container, { page: true });
    });
  });
});
