import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLocation } from 'react-router';

import { AppRoutes } from '../../../app/AppRoutes';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  jsonResponse,
  renderWithProviders,
  TEST_API_URL,
} from '../../../test/render-with-providers';

const TOKEN = 'Y5Htkdgmcj2jq09UMi2SxO28iot3Cb9eBloOlf0K-YA';
const CONFIRM_URL = `${TEST_API_URL}/api/v1/auth/password-reset/confirm`;
const NEW_PASSWORD = 'my-new-passphrase';
const PASSWORD_UPDATED = 'Tu contraseña se ha actualizado. Inicia sesión con la nueva.';

const confirmed = () => jsonResponse(200, { message: 'Password has been reset successfully.' });
const invalidLink = () =>
  jsonResponse(400, {
    statusCode: 400,
    error: 'Bad Request',
    message: 'This reset link is no longer valid',
    code: 'RESET_TOKEN_INVALID',
  });

/** Shows where the router is, history state included, so tests can check what the URL holds. */
function LocationProbe() {
  const location = useLocation();
  return (
    <output data-testid="location">
      {JSON.stringify({ path: `${location.pathname}${location.search}`, state: location.state })}
    </output>
  );
}

function currentLocation(): { path: string; state: unknown } {
  return JSON.parse(screen.getByTestId('location').textContent ?? '{}') as {
    path: string;
    state: unknown;
  };
}

type Entry = string | { pathname: string; state?: unknown };

function renderPage(
  fetchMock: typeof fetch = vi.fn(),
  entry: Entry = `/reset-password?token=${TOKEN}`,
) {
  return renderWithProviders(
    <>
      <AppRoutes />
      <LocationProbe />
    </>,
    { initialEntries: [entry], fetch: fetchMock },
  );
}

const field = {
  password: () => screen.getByLabelText('Nueva contraseña', { selector: 'input' }),
  confirmPassword: () => screen.getByLabelText('Confirmar contraseña', { selector: 'input' }),
  submit: () => screen.getByRole('button', { name: 'Guardar contraseña' }),
};

async function setNewPassword(password = NEW_PASSWORD, confirmation = password) {
  const user = userEvent.setup();
  await user.type(field.password(), password);
  await user.type(field.confirmPassword(), confirmation);
  await user.click(field.submit());
  return user;
}

async function expectInvalidLinkScreen() {
  expect(
    await screen.findByRole('heading', { level: 1, name: 'Este enlace ya no es válido' }),
  ).toBeInTheDocument();
  expect(screen.getByText('Puede haber caducado o haberse usado ya.')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Pedir un enlace nuevo' })).toHaveAttribute(
    'href',
    '/forgot-password',
  );
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
}

describe('ResetPasswordPage (/reset-password, US-IAM-004)', () => {
  describe('the link token (D8)', () => {
    it('moves the token out of the address bar into history state on load', async () => {
      renderPage();

      await waitFor(() =>
        expect(currentLocation()).toEqual({ path: '/reset-password', state: { token: TOKEN } }),
      );
      expect(screen.getByRole('form', { name: 'Crea una contraseña nueva' })).toBeInTheDocument();
    });

    it('keeps working after a reload, with the token only in history state', async () => {
      const fetchMock = vi.fn().mockResolvedValue(confirmed());
      renderPage(fetchMock, { pathname: '/reset-password', state: { token: TOKEN } });

      await setNewPassword();

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
        token: TOKEN,
      });
    });

    it('asks the browser not to send this page as the Referer of any request', async () => {
      renderPage();

      await waitFor(() =>
        expect(document.head.querySelector('meta[name="referrer"]')).toHaveAttribute(
          'content',
          'no-referrer',
        ),
      );
    });

    it('without a token, says the link is not valid and offers a new one', async () => {
      renderPage(vi.fn(), '/reset-password');

      await expectInvalidLinkScreen();
    });
  });

  describe('the form', () => {
    it('shows a titled form with both password fields, their toggles and the requirement', async () => {
      renderPage();

      expect(
        screen.getByRole('heading', { level: 1, name: 'Crea una contraseña nueva' }),
      ).toBeInTheDocument();
      expect(field.password()).toHaveAttribute('autocomplete', 'new-password');
      expect(field.confirmPassword()).toHaveAttribute('autocomplete', 'new-password');
      expect(screen.getByRole('button', { name: 'Mostrar contraseña' })).toBeInTheDocument();
      expect(
        screen.getByRole('button', { name: 'Mostrar confirmación de contraseña' }),
      ).toBeInTheDocument();
      expect(screen.getByText(/Al menos 8 caracteres/)).toBeInTheDocument();
      await waitFor(() => expect(document.title).toBe('Crea una contraseña nueva · YouPetMe'));
    });

    it('has no accessibility violations', async () => {
      const { container } = renderPage();

      await expectNoAxeViolations(container, { page: true });
    });

    it('Scenario 5 — reports a password under 8 characters when the field is left', async () => {
      const fetchMock = vi.fn();
      renderPage(fetchMock);
      const user = userEvent.setup();

      await user.type(field.password(), 'short');
      await user.tab();

      expect(
        await screen.findByText('La contraseña debe tener al menos 8 caracteres.'),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('reports a confirmation that differs, without sending anything', async () => {
      const fetchMock = vi.fn();
      renderPage(fetchMock);

      await setNewPassword(NEW_PASSWORD, 'my-new-passphrasE');

      expect(
        await screen.findByText(
          'Las contraseñas deben coincidir. Revisa que las dos sean iguales.',
        ),
      ).toBeInTheDocument();
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('Scenario 3 — Given a valid link, When a valid new password is sent', () => {
    it('Then it sets the password and sends the user to /login with a confirmation (D9)', async () => {
      const fetchMock = vi.fn().mockResolvedValue(confirmed());
      renderPage(fetchMock);

      await setNewPassword();

      expect(await screen.findByText(PASSWORD_UPDATED)).toBeInTheDocument();
      expect(screen.getByRole('heading', { level: 1, name: 'Iniciar sesión' })).toBeInTheDocument();
      expect(currentLocation().path).toBe('/login');
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(CONFIRM_URL);
      expect(JSON.parse(init.body as string)).toEqual({
        token: TOKEN,
        password: NEW_PASSWORD,
        confirmPassword: NEW_PASSWORD,
      });
    });

    it('Then it sends a single request while the first one is pending', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
      renderPage(fetchMock);

      const user = await setNewPassword();
      const pending = screen.getByRole('button', { name: /Guardando contraseña/ });
      expect(pending).toHaveAttribute('aria-disabled', 'true');
      await user.click(pending);
      await user.keyboard('{Enter}');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      answer(confirmed());
      expect(await screen.findByText(PASSWORD_UPDATED)).toBeInTheDocument();
    });

    it('Then a signed-in user is signed out too, since every session was revoked (D6)', async () => {
      const fetchMock = vi.fn((url: string) => {
        if (url.endsWith('/auth/refresh')) {
          return Promise.resolve(
            jsonResponse(200, {
              user: {
                id: 'u-1',
                firstName: 'Ana',
                lastName: 'Ruiz',
                email: 'ana@example.com',
                status: 'ACTIVE',
              },
              authentication: { accessToken: 'restored-token' },
            }),
          );
        }
        if (url.endsWith('/auth/logout'))
          return Promise.resolve(new Response(null, { status: 204 }));
        return Promise.resolve(confirmed());
      });
      renderWithProviders(
        <>
          <AppRoutes />
          <LocationProbe />
        </>,
        {
          initialEntries: [`/reset-password?token=${TOKEN}`],
          auth: 'restore',
          fetch: fetchMock as unknown as typeof fetch,
        },
      );
      expect(await screen.findByRole('banner')).toHaveTextContent('Hola, Ana');

      await setNewPassword();

      expect(await screen.findByText(PASSWORD_UPDATED)).toBeInTheDocument();
      expect(screen.getByRole('banner')).not.toHaveTextContent('Hola, Ana');
      expect(currentLocation().path).toBe('/login');
      expect(fetchMock.mock.calls.map(([url]) => url)).toContain(
        `${TEST_API_URL}/api/v1/auth/logout`,
      );
    });
  });

  describe('Scenario 4 — Given a link that is expired, used or superseded', () => {
    it('Then it says the link is not valid and offers a new one', async () => {
      renderPage(vi.fn().mockResolvedValue(invalidLink()));

      await setNewPassword();

      await expectInvalidLinkScreen();
    });
  });

  describe('When the request fails for another reason', () => {
    it('keeps the form and explains a network failure', async () => {
      renderPage(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await setNewPassword();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No hemos podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
      );
      expect(field.password()).toBeInTheDocument();
    });

    it('shows the server validation on its field', async () => {
      renderPage(
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: [{ field: 'password', code: 'TOO_SHORT', message: 'x' }],
          }),
        ),
      );
      const user = userEvent.setup();

      await user.type(field.password(), NEW_PASSWORD);
      // Sent with Enter: a click would defer the field's own blur check past this instant answer.
      await user.type(field.confirmPassword(), `${NEW_PASSWORD}{Enter}`);

      expect(
        await screen.findByText('La contraseña debe tener al menos 8 caracteres.'),
      ).toBeInTheDocument();
    });
  });
});
