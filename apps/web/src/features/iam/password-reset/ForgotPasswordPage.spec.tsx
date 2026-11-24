import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AppRoutes } from '../../../app/AppRoutes';
import { expectNoAxeViolations } from '../../../test/axe';
import {
  jsonResponse,
  renderWithProviders,
  TEST_API_URL,
} from '../../../test/render-with-providers';

const GENERIC_SENT =
  'Si hay una cuenta con ese email, te hemos enviado un enlace. Caduca en 2 horas. Si no lo ves en unos minutos, revisa la carpeta de spam o vuelve a intentarlo.';

const accepted = () =>
  jsonResponse(202, {
    message: 'If an account exists for this email, a reset link has been sent.',
  });

function renderPage(fetchMock: typeof fetch = vi.fn()) {
  return renderWithProviders(<AppRoutes />, {
    initialEntries: ['/forgot-password'],
    fetch: fetchMock,
  });
}

const emailInput = () => screen.getByLabelText('Correo electrónico', { selector: 'input' });
const submitButton = () => screen.getByRole('button', { name: 'Enviar enlace' });

/** The confirmation is a status message, whatever the account (Scenarios 1 and 2). */
async function expectGenericConfirmation() {
  const sent = await screen.findByText(GENERIC_SENT);
  expect(sent.closest('[role="status"]')).not.toBeNull();
}

async function requestLink(email = 'ana@example.com') {
  const user = userEvent.setup();
  await user.type(emailInput(), email);
  await user.click(submitButton());
  return user;
}

describe('ForgotPasswordPage (/forgot-password, US-IAM-004)', () => {
  it('shows a titled form to request a link, with a way back to login', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Recupera tu contraseña' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('form', { name: 'Recupera tu contraseña' })).toBeInTheDocument();
    expect(emailInput()).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toHaveAttribute(
      'href',
      '/login',
    );
    await waitFor(() => expect(document.title).toBe('Recupera tu contraseña · YouPetMe'));
  });

  it('has no accessibility violations', async () => {
    const { container } = renderPage();

    await expectNoAxeViolations(container, { page: true });
  });

  it('reports an invalid email when the field is left, before sending anything', async () => {
    const fetchMock = vi.fn();
    renderPage(fetchMock);
    const user = userEvent.setup();

    await user.type(emailInput(), 'not-an-email');
    await user.tab();

    expect(
      await screen.findByText('Escribe un correo válido, por ejemplo nombre@ejemplo.com.'),
    ).toBeInTheDocument();
    await user.click(submitButton());
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('Scenarios 1 and 2 — When an email is sent', () => {
    it('Then it requests a link for the trimmed email and shows the generic confirmation', async () => {
      const fetchMock = vi.fn().mockResolvedValue(accepted());
      renderPage(fetchMock);

      await requestLink('  ana@example.com ');

      await expectGenericConfirmation();
      expect(screen.queryByRole('form')).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Volver a iniciar sesión' })).toBeInTheDocument();
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${TEST_API_URL}/api/v1/auth/password-reset/request`);
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual({ email: 'ana@example.com' });
    });

    it('Then it sends a single request while the first one is pending', async () => {
      let answer: (response: Response) => void = () => undefined;
      const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (answer = resolve)));
      renderPage(fetchMock);

      const user = await requestLink();
      const pending = screen.getByRole('button', { name: /Enviando enlace/ });
      expect(pending).toHaveAttribute('aria-disabled', 'true');
      await user.click(pending);
      await user.keyboard('{Enter}');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      answer(accepted());
      await expectGenericConfirmation();
    });
  });

  describe('When the request fails', () => {
    it('keeps the form and explains a network failure', async () => {
      renderPage(vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

      await requestLink();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No hemos podido conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
      );
      expect(emailInput()).toHaveValue('ana@example.com');
    });

    it('shows the server validation of the email on the field', async () => {
      renderPage(
        vi.fn().mockResolvedValue(
          jsonResponse(400, {
            statusCode: 400,
            error: 'Bad Request',
            message: 'Validation failed',
            details: [{ field: 'email', code: 'INVALID_FORMAT', message: 'x' }],
          }),
        ),
      );
      const user = userEvent.setup();

      // Sent with Enter: a click would defer the field's own blur check past this instant answer.
      await user.type(emailInput(), 'ana@example.com{Enter}');

      expect(
        await screen.findByText('Escribe un correo válido, por ejemplo nombre@ejemplo.com.'),
      ).toBeInTheDocument();
    });

    it('explains a server error generically', async () => {
      renderPage(
        vi.fn().mockResolvedValue(jsonResponse(500, { statusCode: 500, error: 'x', message: 'x' })),
      );

      await requestLink();

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Algo ha fallado por nuestra parte. Inténtalo de nuevo en unos minutos.',
      );
    });
  });

  it('sends someone who is already signed in to the home instead (D6)', async () => {
    renderWithProviders(<AppRoutes />, {
      initialEntries: ['/forgot-password'],
      auth: 'restore',
      fetch: vi.fn().mockResolvedValue(
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
      ),
    });

    expect(await screen.findByText('Has iniciado sesión.')).toBeInTheDocument();
    expect(screen.queryByRole('form')).not.toBeInTheDocument();
  });
});
