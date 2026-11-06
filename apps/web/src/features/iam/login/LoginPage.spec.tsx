import type { LoginResponse } from '@youpetme/contracts';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRoutes } from '../../../app/AppRoutes';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  jsonResponse,
  renderWithProviders,
  TEST_API_URL,
} from '../../../test/render-with-providers';

const signedIn: LoginResponse = {
  user: {
    id: 'u-1',
    firstName: 'Ana',
    lastName: 'Ruiz',
    email: 'ana@example.com',
    status: 'ACTIVE',
  },
  authentication: { accessToken: 'access-token-value' },
};

function renderLogin(fetchMock: typeof fetch = vi.fn()) {
  return renderWithProviders(<AppRoutes />, { initialEntries: ['/login'], fetch: fetchMock });
}

function form() {
  return {
    email: screen.getByLabelText('Correo electrónico', { selector: 'input' }),
    password: screen.getByLabelText('Contraseña', { selector: 'input' }),
    submit: screen.getByRole('button', { name: 'Iniciar sesión' }),
  };
}

async function fillAndSubmit(email = 'ana@example.com', password = 'my-secure-passphrase') {
  const user = userEvent.setup();
  const fields = form();
  await user.type(fields.email, email);
  await user.type(fields.password, password);
  await user.click(fields.submit);
  return user;
}

describe('LoginPage (/login, US-IAM-002)', () => {
  it('shows a titled form with links to registration and password recovery', async () => {
    renderLogin();

    expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(form().email).toHaveAttribute('autocomplete', 'email');
    expect(form().password).toHaveAttribute('autocomplete', 'current-password');
    expect(screen.getByRole('link', { name: '¿Has olvidado tu contraseña?' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toHaveAttribute('href', '/register');
    await waitFor(() => expect(document.title).toBe('Iniciar sesión · YouPetMe'));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderLogin();

    await expectNoAxeViolations(container, { page: true });
  });

  describe('Scenario 1 — Given an ACTIVE account, When the right credentials are sent', () => {
    it('Then it signs in, lands on the authenticated home and greets the user', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, signedIn));
      renderLogin(fetchMock);

      await fillAndSubmit('  ana@example.com ');

      expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
      expect(screen.getByRole('banner')).toHaveTextContent('Hola, Ana');
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${TEST_API_URL}/api/v1/auth/login`);
      expect(JSON.parse(init.body as string)).toEqual({
        email: 'ana@example.com',
        password: 'my-secure-passphrase',
      });
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
    });

    it('Then it sends a single request while the first one is pending', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
      renderLogin(fetchMock);

      const user = await fillAndSubmit();
      const pending = screen.getByRole('button', { name: /Iniciando sesión/ });
      expect(pending).toHaveAttribute('aria-disabled', 'true');
      await user.click(pending);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      answer(jsonResponse(200, signedIn));
      expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
    });
  });

  describe('Scenario 2 — Given wrong credentials', () => {
    it('Then it shows the same generic message for an unknown email and a wrong password', async () => {
      const invalid = () =>
        jsonResponse(401, {
          statusCode: 401,
          error: 'Unauthorized',
          message: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
        });
      renderLogin(vi.fn().mockImplementation(() => Promise.resolve(invalid())));

      await fillAndSubmit();

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent('El correo o la contraseña no son correctos.');
      expect(form().email).not.toHaveAttribute('aria-invalid', 'true');
      expect(form().password).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('Scenario 3 — Given an account that is not ACTIVE', () => {
    it('Then it says the account is not available, without the reason', async () => {
      renderLogin(
        vi.fn().mockResolvedValue(
          jsonResponse(403, {
            statusCode: 403,
            error: 'Forbidden',
            message: 'This account is not available',
            code: 'ACCOUNT_NOT_AVAILABLE',
          }),
        ),
      );

      await fillAndSubmit();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Esta cuenta no está disponible en este momento.',
      );
    });
  });

  describe('client validation', () => {
    it('does not send the request and explains each missing field', async () => {
      const fetchMock = vi.fn();
      const user = userEvent.setup();
      renderLogin(fetchMock);

      await user.click(form().submit);

      expect(await screen.findByText('Escribe tu correo electrónico.')).toBeInTheDocument();
      expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
      expect(form().email).toHaveFocus();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not apply the password length rule of registration', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, signedIn));
      renderLogin(fetchMock);

      await fillAndSubmit('ana@example.com', 'short');

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  it('never writes the password or the token to the console', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => undefined),
    );
    renderLogin(vi.fn().mockResolvedValue(jsonResponse(200, signedIn)));

    await fillAndSubmit('ana@example.com', 'my-secure-passphrase');
    await screen.findByText('Has iniciado sesión.');

    const logged = JSON.stringify(spies.flatMap((spy) => spy.mock.calls));
    expect(logged).not.toContain('my-secure-passphrase');
    expect(logged).not.toContain('access-token-value');
    spies.forEach((spy) => spy.mockRestore());
  });
});
