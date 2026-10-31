import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';

import { DIANGO_WELCOME_SEEN_KEY } from '../../../lib/storage/diango-welcome';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  jsonResponse,
  renderWithProviders,
  TEST_API_URL,
} from '../../../test/render-with-providers';
import { useAuth } from '../auth/auth-state';
import { RegisterPage } from './RegisterPage';

const created = {
  user: {
    id: 'u-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: 'ACTIVE',
  },
  authentication: { accessToken: 'access-token-value' },
};

function HomeProbe() {
  const { session } = useAuth();
  return <p>home: {session ? session.user.firstName : 'visitor'}</p>;
}

function renderRegister(fetchImpl: typeof fetch) {
  return renderWithProviders(
    <Routes>
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<HomeProbe />} />
    </Routes>,
    { fetch: fetchImpl, initialEntries: ['/register'] },
  );
}

const field = {
  firstName: () => screen.getByLabelText('Nombre', { selector: 'input' }),
  lastName: () => screen.getByLabelText('Apellidos', { selector: 'input' }),
  email: () => screen.getByLabelText('Correo electrónico', { selector: 'input' }),
  password: () => screen.getByLabelText('Contraseña', { selector: 'input' }),
  confirmPassword: () => screen.getByLabelText('Confirmar contraseña', { selector: 'input' }),
  terms: () => screen.getByRole('checkbox', { name: /Acepto los/ }),
  submit: () => screen.getByRole('button', { name: /Crear cuenta|Creando tu cuenta/ }),
};

async function fillValidForm(
  user: ReturnType<typeof userEvent.setup>,
  overrides: Partial<Record<'password' | 'confirmPassword' | 'email', string>> = {},
) {
  await user.type(field.firstName(), 'John');
  await user.type(field.lastName(), 'Doe');
  await user.type(field.email(), overrides.email ?? 'john@example.com');
  await user.type(field.password(), overrides.password ?? 'my-secure-passphrase');
  await user.type(field.confirmPassword(), overrides.confirmPassword ?? 'my-secure-passphrase');
  await user.click(field.terms());
}

/** Text of the error tied to a field by aria-describedby, as assistive technology reads it. */
function errorOf(input: HTMLElement): string {
  if (input.getAttribute('aria-invalid') !== 'true') return '';
  return (input.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => {
      const clone = document.getElementById(id)?.cloneNode(true) as HTMLElement | undefined;
      clone?.querySelectorAll('[aria-hidden="true"]').forEach((node) => node.remove());
      return clone?.textContent?.trim() ?? '';
    })
    .filter(Boolean)
    .join(' ');
}

describe('RegisterPage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('structure and accessibility', () => {
    it('has one level-1 heading that names the form', () => {
      renderRegister(vi.fn());

      const heading = screen.getByRole('heading', { level: 1, name: 'Crea tu cuenta' });
      expect(screen.getByRole('form', { name: 'Crea tu cuenta' })).toBeInTheDocument();
      expect(heading).toBeVisible();
    });

    it('uses the right input types, names and autocomplete values', () => {
      renderRegister(vi.fn());

      expect(field.firstName()).toHaveAttribute('autocomplete', 'given-name');
      expect(field.firstName()).toHaveAttribute('name', 'firstName');
      expect(field.lastName()).toHaveAttribute('autocomplete', 'family-name');
      expect(field.lastName()).toHaveAttribute('name', 'lastName');
      expect(field.email()).toHaveAttribute('type', 'email');
      expect(field.email()).toHaveAttribute('autocomplete', 'email');
      expect(field.email()).toHaveAttribute('name', 'email');
      expect(field.password()).toHaveAttribute('type', 'password');
      expect(field.password()).toHaveAttribute('autocomplete', 'new-password');
      expect(field.password()).toHaveAttribute('name', 'password');
      expect(field.confirmPassword()).toHaveAttribute('autocomplete', 'new-password');
      expect(field.confirmPassword()).toHaveAttribute('name', 'confirmPassword');
      expect(field.terms()).toHaveAttribute('name', 'termsAccepted');
      for (const input of [
        field.firstName(),
        field.lastName(),
        field.email(),
        field.password(),
        field.confirmPassword(),
        field.terms(),
      ]) {
        expect(input).toBeRequired();
      }
    });

    it('links to the Terms and the Privacy Policy in a new tab, so the form is not lost', () => {
      renderRegister(vi.fn());

      const terms = screen.getByRole('link', { name: /Términos de Servicio/ });
      const privacy = screen.getByRole('link', { name: /Política de Privacidad/ });
      expect(terms).toHaveAttribute('href', '/terms');
      expect(privacy).toHaveAttribute('href', '/privacy');
      for (const link of [terms, privacy]) {
        expect(link).toHaveAttribute('target', '_blank');
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
        expect(link).toHaveAccessibleName(/se abre en una pestaña nueva/);
      }
    });

    it('offers a way to log in', () => {
      renderRegister(vi.fn());

      expect(screen.getByText('¿Ya tienes una cuenta?')).toBeVisible();
      expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
        'href',
        '/login',
      );
    });

    it('has no accessibility violations, empty or showing every error', async () => {
      const user = userEvent.setup();
      const { container } = renderRegister(vi.fn());
      await expectNoAxeViolations(container);

      await user.click(field.submit());
      await screen.findAllByText(/para continuar|Para crear la cuenta|Repite/);

      await expectNoAxeViolations(container);
    });

    it('can be completed and submitted with the keyboard alone', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await user.tab();
      expect(field.firstName()).toHaveFocus();
      await user.keyboard('John');
      await user.tab();
      expect(field.lastName()).toHaveFocus();
      await user.keyboard('Doe');
      await user.tab();
      expect(field.email()).toHaveFocus();
      await user.keyboard('john@example.com');
      await user.tab();
      expect(field.password()).toHaveFocus();
      await user.keyboard('my-secure-passphrase');
      await user.tab();
      expect(screen.getAllByRole('button', { name: 'Mostrar contraseña' })[0]).toHaveFocus();
      await user.tab();
      expect(field.confirmPassword()).toHaveFocus();
      await user.keyboard('my-secure-passphrase');
      await user.tab();
      await user.tab();
      expect(field.terms()).toHaveFocus();
      await user.keyboard(' ');
      expect(field.terms()).toBeChecked();
      // Back to the confirmation input (past its show/hide toggle); Enter there submits the form.
      await user.keyboard('{Shift>}{Tab}{Tab}{/Shift}');
      expect(field.confirmPassword()).toHaveFocus();
      await user.keyboard('{Enter}');

      await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    });
  });

  describe('BDD 1 — successful registration', () => {
    it('creates the account, keeps the token in memory and goes to the authenticated home', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());

      expect(await screen.findByText('home: John')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${TEST_API_URL}/api/v1/auth/register`);
      expect(init.method).toBe('POST');
      expect(init.credentials).toBe('include');
      expect(JSON.parse(init.body as string)).toEqual({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        password: 'my-secure-passphrase',
        confirmPassword: 'my-secure-passphrase',
        termsAccepted: true,
      });
      expect(window.localStorage.length).toBe(0);
      expect(window.sessionStorage.length).toBe(0);
      expect(document.cookie).toBe('');
    });

    it('does not leave the form in the history, so Back does not return to it', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn().mockResolvedValue(jsonResponse(201, created)));

      await fillValidForm(user);
      await user.click(field.submit());

      await screen.findByText('home: John');
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
    });

    it('sends hasSeenWelcome: true only when the guest already saw the welcome', async () => {
      window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());

      await screen.findByText('home: John');
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toHaveProperty(
        'hasSeenWelcome',
        true,
      );
    });

    it('omits hasSeenWelcome when the mark is missing or storage is unavailable', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());

      await screen.findByText('home: John');
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).not.toHaveProperty(
        'hasSeenWelcome',
      );
    });

    it('trims names and email before sending', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await user.type(field.firstName(), '  John ');
      await user.type(field.lastName(), ' Doe  ');
      await user.type(field.email(), ' john@example.com ');
      await user.type(field.password(), 'my-secure-passphrase');
      await user.type(field.confirmPassword(), 'my-secure-passphrase');
      await user.click(field.terms());
      await user.click(field.submit());

      await screen.findByText('home: John');
      expect(JSON.parse(fetchMock.mock.calls[0]![1].body as string)).toMatchObject({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      });
    });
  });

  describe('BDD 2 — email already registered', () => {
    it('shows "in use" on the email field, focuses it and exposes nothing else', async () => {
      const user = userEvent.setup();
      renderRegister(
        vi.fn().mockResolvedValue(
          jsonResponse(409, {
            statusCode: 409,
            error: 'Conflict',
            message: 'This email is already in use',
          }),
        ),
      );

      await fillValidForm(user);
      await user.click(field.submit());

      await waitFor(() => expect(field.email()).toHaveFocus());
      expect(field.email()).toHaveAttribute('aria-invalid', 'true');
      expect(errorOf(field.email())).toBe(
        'Este correo ya está en uso. Inicia sesión o prueba con otro correo.',
      );
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      expect(screen.queryByText('home: John')).not.toBeInTheDocument();
    });

    it('keeps what the user typed, so they can fix the email', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn().mockResolvedValue(jsonResponse(409, { statusCode: 409 })));

      await fillValidForm(user);
      await user.click(field.submit());
      await waitFor(() => expect(field.email()).toHaveFocus());

      expect(field.firstName()).toHaveValue('John');
      expect(field.email()).toHaveValue('john@example.com');
      expect(field.terms()).toBeChecked();
    });

    it('can be resubmitted after changing the email', async () => {
      const user = userEvent.setup();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(409, { statusCode: 409 }))
        .mockResolvedValueOnce(jsonResponse(201, created));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());
      await waitFor(() => expect(field.email()).toHaveFocus());
      await user.clear(field.email());
      await user.type(field.email(), 'other@example.com');
      await user.click(field.submit());

      expect(await screen.findByText('home: John')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('BDD 3 — passwords do not match', () => {
    it('shows the error on the confirmation field before sending', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      renderRegister(fetchMock);

      await user.type(field.password(), 'my-secure-passphrase');
      await user.type(field.confirmPassword(), 'another-passphrase');
      await user.tab();

      expect(field.confirmPassword()).toHaveAttribute('aria-invalid', 'true');
      expect(errorOf(field.confirmPassword())).toBe(
        'Las contraseñas deben coincidir. Revisa que las dos sean iguales.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('blocks the submission and keeps the error', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      renderRegister(fetchMock);

      await fillValidForm(user, { confirmPassword: 'another-passphrase' });
      await user.click(field.submit());

      expect(errorOf(field.confirmPassword())).toContain('Las contraseñas deben coincidir');
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('BDD 4 — password below the policy', () => {
    it('explains the minimum length and blocks the submission', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      renderRegister(fetchMock);

      await fillValidForm(user, { password: 'short12', confirmPassword: 'short12' });
      await user.click(field.submit());

      expect(errorOf(field.password())).toContain(
        'La contraseña debe tener al menos 8 caracteres.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('shows the requirement near the field and updates it as the user types', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn());

      expect(field.password()).toHaveAccessibleDescription('Al menos 8 caracteres — pendiente');
      await user.type(field.password(), 'abcdefg');
      expect(field.password()).toHaveAccessibleDescription('Al menos 8 caracteres — pendiente');
      await user.type(field.password(), 'h');
      expect(field.password()).toHaveAccessibleDescription('Al menos 8 caracteres — cumplido');
    });

    it('does not mark the requirement as met above the maximum', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn());

      await user.click(field.password());
      await user.paste('a'.repeat(129));

      expect(field.password()).toHaveAccessibleDescription('Al menos 8 caracteres — pendiente');
    });
  });

  describe('BDD 5 — terms not accepted', () => {
    it('shows an error on the checkbox and does not send the form', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      renderRegister(fetchMock);

      await user.type(field.firstName(), 'John');
      await user.type(field.lastName(), 'Doe');
      await user.type(field.email(), 'john@example.com');
      await user.type(field.password(), 'my-secure-passphrase');
      await user.type(field.confirmPassword(), 'my-secure-passphrase');
      await user.click(field.submit());

      expect(field.terms()).toHaveAttribute('aria-invalid', 'true');
      expect(errorOf(field.terms())).toBe(
        'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('clears the error once the box is checked and the form can be sent', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, created));
      renderRegister(fetchMock);

      await user.type(field.firstName(), 'John');
      await user.type(field.lastName(), 'Doe');
      await user.type(field.email(), 'john@example.com');
      await user.type(field.password(), 'my-secure-passphrase');
      await user.type(field.confirmPassword(), 'my-secure-passphrase');
      await user.click(field.submit());
      await user.click(field.terms());
      await user.click(field.submit());

      expect(await screen.findByText('home: John')).toBeInTheDocument();
    });
  });

  describe('BDD 6 — required fields left empty', () => {
    it('shows a specific error for each empty field, focuses the first one and sends nothing', async () => {
      const user = userEvent.setup();
      const fetchMock = vi.fn();
      renderRegister(fetchMock);

      await user.click(field.submit());

      expect(errorOf(field.firstName())).toBe('Escribe tu nombre para continuar.');
      expect(errorOf(field.lastName())).toBe('Escribe tus apellidos para continuar.');
      expect(errorOf(field.email())).toBe('Escribe tu correo electrónico.');
      expect(errorOf(field.password())).toContain('Crea una contraseña para continuar.');
      expect(errorOf(field.confirmPassword())).toBe('Repite la contraseña para confirmarla.');
      expect(errorOf(field.terms())).toBe(
        'Para crear la cuenta, acepta los Términos de Servicio y la Política de Privacidad.',
      );
      expect(field.firstName()).toHaveFocus();
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('focuses the first invalid field, not always the first field', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn());

      await user.type(field.firstName(), 'John');
      await user.type(field.lastName(), 'Doe');
      await user.click(field.submit());

      expect(field.email()).toHaveFocus();
    });
  });

  describe('validation timing (Design System — Form and validation guidelines)', () => {
    it('does not show an error while the user is still typing, only when leaving the field', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn());

      await user.type(field.email(), 'john@');
      expect(field.email()).not.toHaveAttribute('aria-invalid', 'true');
      await user.tab();

      expect(errorOf(field.email())).toBe(
        'Escribe un correo válido, por ejemplo nombre@ejemplo.com.',
      );
    });

    it('clears a field error as soon as the user comes back to it', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn());

      await user.click(field.email());
      await user.tab();
      expect(field.email()).toHaveAttribute('aria-invalid', 'true');

      await user.click(field.email());

      expect(field.email()).not.toHaveAttribute('aria-invalid', 'true');
    });
  });

  describe('errors returned by the API', () => {
    it('places 400 details on their fields and focuses the first', async () => {
      const user = userEvent.setup();
      renderRegister(
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: [
              { field: 'email', code: 'INVALID_FORMAT', message: 'English text never shown' },
              { field: 'password', code: 'TOO_SHORT', message: 'English text never shown' },
            ],
          }),
        ),
      );

      await fillValidForm(user);
      await user.click(field.submit());

      await waitFor(() => expect(field.email()).toHaveFocus());
      expect(errorOf(field.email())).toBe(
        'Escribe un correo válido, por ejemplo nombre@ejemplo.com.',
      );
      expect(errorOf(field.password())).toContain(
        'La contraseña debe tener al menos 8 caracteres.',
      );
      expect(screen.queryByText(/English text never shown/)).not.toBeInTheDocument();
    });

    it.each([
      [403, 'No hemos podido enviar tu solicitud. Recarga la página e inténtalo de nuevo.'],
      [415, 'No hemos podido enviar tu solicitud. Recarga la página e inténtalo de nuevo.'],
      [500, 'Algo ha fallado por nuestra parte. Inténtalo de nuevo en unos minutos.'],
      [418, 'No hemos podido crear la cuenta. Inténtalo de nuevo.'],
    ])('shows a general alert for %i and keeps the form data', async (status, message) => {
      const user = userEvent.setup();
      renderRegister(
        vi
          .fn()
          .mockResolvedValue(
            jsonResponse(status, { statusCode: status, error: 'x', message: 'internal detail' }),
          ),
      );

      await fillValidForm(user);
      await user.click(field.submit());

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(message);
      expect(alert).toHaveFocus();
      expect(screen.queryByText(/internal detail/)).not.toBeInTheDocument();
      expect(field.email()).toHaveValue('john@example.com');
      expect(field.password()).toHaveValue('my-secure-passphrase');
    });

    it('shows a connection message when the network fails', async () => {
      const user = userEvent.setup();
      renderRegister(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await fillValidForm(user);
      await user.click(field.submit());

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No hemos podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
      );
    });

    it('lets the user retry after a failure and clears the alert', async () => {
      const user = userEvent.setup();
      const fetchMock = vi
        .fn()
        .mockResolvedValueOnce(jsonResponse(500, { statusCode: 500 }))
        .mockResolvedValueOnce(jsonResponse(201, created));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());
      await screen.findByRole('alert');
      await user.click(field.submit());

      expect(await screen.findByText('home: John')).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('never writes the password or the token anywhere, nor logs them', async () => {
      const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const user = userEvent.setup();
      renderRegister(vi.fn().mockResolvedValue(jsonResponse(500, { statusCode: 500 })));

      await fillValidForm(user);
      await user.click(field.submit());
      await screen.findByRole('alert');

      const output = JSON.stringify([log.mock.calls, error.mock.calls, warn.mock.calls]);
      expect(output).not.toContain('my-secure-passphrase');
      expect(window.localStorage.length).toBe(0);
    });
  });

  describe('while the request is in flight', () => {
    it('blocks duplicate submissions and announces the state', async () => {
      const user = userEvent.setup();
      let resolve!: (response: Response) => void;
      const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((r) => (resolve = r)));
      renderRegister(fetchMock);

      await fillValidForm(user);
      await user.click(field.submit());
      await user.click(field.submit());
      await user.keyboard('{Enter}');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const button = screen.getByRole('button', { name: 'Creando tu cuenta…' });
      expect(button).toHaveAttribute('aria-busy', 'true');
      expect(within(document.body).getByRole('status')).toHaveTextContent('Creando tu cuenta…');

      resolve(jsonResponse(201, created));
      expect(await screen.findByText('home: John')).toBeInTheDocument();
    });
  });
});
