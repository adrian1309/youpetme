import type { RefreshResponse } from '@youpetme/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DIANGO_WELCOME_SEEN_KEY } from '../../lib/storage/diango-welcome';
import { expectNoAxeViolations } from '../../test/axe';
import { jsonResponse, renderWithProviders, TEST_API_URL } from '../../test/render-with-providers';
import { ASSISTANT_MESSAGES_PATH, WELCOME_SEEN_PATH } from './assistant-api';
import { Diango } from './Diango';

type Call = { url: string; method: string; body: unknown; authorization: string | null };

function signedIn(hasSeenWelcome: boolean): RefreshResponse {
  return {
    user: {
      id: 'u-1',
      firstName: 'Ana',
      lastName: 'Ruiz',
      email: 'ana@example.com',
      status: 'ACTIVE',
      role: 'USER',
      hasSeenWelcome,
    },
    authentication: { accessToken: 'access-token' },
  };
}

/** Fake API: refresh (when signed in), the welcome PUT and queued chat answers. */
function fakeApi(options: { session?: RefreshResponse; replies?: Response[] } = {}) {
  const calls: Call[] = [];
  const replies = [...(options.replies ?? [])];
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input).replace(TEST_API_URL, '');
    const method = init?.method ?? 'GET';
    calls.push({
      url,
      method,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: new Headers(init?.headers).get('Authorization'),
    });
    if (url === '/api/v1/auth/refresh') {
      return options.session ? jsonResponse(200, options.session) : jsonResponse(401, {});
    }
    if (url === WELCOME_SEEN_PATH) return new Response(null, { status: 204 });
    if (url === ASSISTANT_MESSAGES_PATH) return replies.shift() ?? jsonResponse(503, {});
    return jsonResponse(404, {});
  });
  return { fetch: fetch as unknown as typeof globalThis.fetch, calls };
}

const welcome = () => screen.queryByRole('dialog', { name: /soy diango/i });
const launcher = () => screen.getByRole('button', { name: /chat de diango/i });

describe('Diango (SCRUM-17 welcome, SCRUM-18 chat)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  describe('welcome', () => {
    it('keeps the focus on "Entendido" while open (focus trapped)', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Diango />);

      const close = within(welcome()!).getByRole('button', { name: /entendido/i });
      await user.tab();
      expect(close).toHaveFocus();
      await user.tab({ shift: true });
      expect(close).toHaveFocus();
    });

    it('greets a first-time guest once, centred, and closing it remembers the guest', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<Diango />);

      const dialog = welcome();
      expect(dialog).toBeInTheDocument();
      expect(within(dialog!).getByRole('button', { name: /entendido/i })).toHaveFocus();
      await expectNoAxeViolations(container);

      await user.click(within(dialog!).getByRole('button', { name: /entendido/i }));

      expect(welcome()).not.toBeInTheDocument();
      expect(window.localStorage.getItem(DIANGO_WELCOME_SEEN_KEY)).toBe('true');
      expect(launcher()).toHaveFocus();
    });

    it('closes with Escape', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Diango />);

      await user.keyboard('{Escape}');

      expect(welcome()).not.toBeInTheDocument();
    });

    it('does not greet a guest who already saw it', () => {
      window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');
      renderWithProviders(<Diango />);

      expect(welcome()).not.toBeInTheDocument();
      expect(launcher()).toBeInTheDocument();
    });

    it('does not greet a signed-in user who already saw it', async () => {
      const api = fakeApi({ session: signedIn(true) });
      renderWithProviders(<Diango />, { fetch: api.fetch, auth: 'restore' });

      expect(await screen.findByRole('button', { name: /chat de diango/i })).toBeInTheDocument();
      expect(welcome()).not.toBeInTheDocument();
    });

    it('records the welcome on the account when a signed-in user closes it', async () => {
      const user = userEvent.setup();
      const api = fakeApi({ session: signedIn(false) });
      renderWithProviders(<Diango />, { fetch: api.fetch, auth: 'restore' });

      const dialog = await screen.findByRole('dialog', { name: /soy diango/i });
      await user.click(within(dialog).getByRole('button', { name: /entendido/i }));

      await waitFor(() =>
        expect(api.calls).toContainEqual(
          expect.objectContaining({
            url: WELCOME_SEEN_PATH,
            method: 'PUT',
            authorization: 'Bearer access-token',
          }),
        ),
      );
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      window.localStorage.setItem(DIANGO_WELCOME_SEEN_KEY, 'true');
    });

    it('sends the question with the session history and shows the reply', async () => {
      const user = userEvent.setup();
      const api = fakeApi({
        replies: [
          jsonResponse(200, { reply: 'Tenemos a Toby.' }),
          jsonResponse(200, { reply: 'Sí, con niños también.' }),
        ],
      });
      const { container } = renderWithProviders(<Diango />, { fetch: api.fetch });

      await user.click(launcher());
      const input = screen.getByRole('textbox', { name: /tu pregunta/i });
      expect(input).toHaveFocus();
      await user.type(input, '¿Tenéis perros pequeños?{Enter}');

      expect(await screen.findByText('Tenemos a Toby.')).toBeInTheDocument();
      await user.type(input, '¿Es bueno con niños?{Enter}');
      expect(await screen.findByText('Sí, con niños también.')).toBeInTheDocument();

      const chats = api.calls.filter((c) => c.url === ASSISTANT_MESSAGES_PATH);
      expect(chats[1]!.body).toEqual({
        messages: [
          { role: 'user', content: '¿Tenéis perros pequeños?' },
          { role: 'assistant', content: 'Tenemos a Toby.' },
          { role: 'user', content: '¿Es bueno con niños?' },
        ],
      });
      expect(chats[0]!.authorization).toBeNull();
      await expectNoAxeViolations(container);
    });

    it('says Diango is not available when the provider fails, and lets the user retry', async () => {
      const user = userEvent.setup();
      const api = fakeApi({
        replies: [jsonResponse(503, {}), jsonResponse(200, { reply: 'Ya estoy aquí.' })],
      });
      const { container } = renderWithProviders(<Diango />, { fetch: api.fetch });

      await user.click(launcher());
      await user.type(screen.getByRole('textbox', { name: /tu pregunta/i }), 'Hola{Enter}');

      const alert = await screen.findByRole('alert');
      expect(alert).toHaveTextContent(/diango no está disponible ahora/i);
      expect(screen.getByText('Hola')).toBeInTheDocument();
      await expectNoAxeViolations(container);

      await user.click(within(alert).getByRole('button', { name: /reintentar/i }));

      expect(await screen.findByText('Ya estoy aquí.')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('sends the access token when signed in', async () => {
      const user = userEvent.setup();
      const api = fakeApi({
        session: signedIn(true),
        replies: [jsonResponse(200, { reply: 'Hola, Ana.' })],
      });
      renderWithProviders(<Diango />, { fetch: api.fetch, auth: 'restore' });

      await user.click(await screen.findByRole('button', { name: /chat de diango/i }));
      await user.type(screen.getByRole('textbox', { name: /tu pregunta/i }), 'Hola{Enter}');

      expect(await screen.findByText('Hola, Ana.')).toBeInTheDocument();
      const chat = api.calls.find((c) => c.url === ASSISTANT_MESSAGES_PATH);
      expect(chat!.authorization).toBe('Bearer access-token');
    });

    it('closes the panel with the "Cerrar chat" icon button', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Diango />);

      await user.click(launcher());
      const close = screen.getByRole('button', { name: 'Cerrar chat' });
      expect(close).toHaveTextContent('');
      await user.click(close);

      expect(screen.queryByRole('dialog', { name: 'Diango' })).not.toBeInTheDocument();
      expect(launcher()).toHaveFocus();
    });

    it('has a round "Enviar mensaje" button, unavailable while there is no text', async () => {
      const user = userEvent.setup();
      const api = fakeApi({ replies: [jsonResponse(200, { reply: 'Tenemos a Toby.' })] });
      renderWithProviders(<Diango />, { fetch: api.fetch });

      await user.click(launcher());
      const send = screen.getByRole('button', { name: 'Enviar mensaje' });
      expect(send).toHaveAttribute('aria-disabled', 'true');
      await user.click(send);
      expect(api.calls.filter((c) => c.url === ASSISTANT_MESSAGES_PATH)).toHaveLength(0);

      await user.type(screen.getByRole('textbox', { name: /tu pregunta/i }), 'Hola');
      expect(send).not.toHaveAttribute('aria-disabled');
      await user.click(send);
      expect(await screen.findByText('Tenemos a Toby.')).toBeInTheDocument();
    });

    it('shows "Diango está pensando…" once, in a polite live region, while it answers', async () => {
      const user = userEvent.setup();
      const fetch = vi.fn(async (input: RequestInfo | URL) =>
        String(input).endsWith('/api/v1/auth/refresh')
          ? jsonResponse(401, {})
          : new Promise<Response>(() => undefined),
      ) as unknown as typeof globalThis.fetch;
      const { container } = renderWithProviders(<Diango />, { fetch });

      await user.click(launcher());
      await user.type(screen.getByRole('textbox', { name: /tu pregunta/i }), 'Hola{Enter}');

      const thinking = await screen.findByText('Diango está pensando…');
      const region = thinking.closest('[role="status"]')!;
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region.querySelector('[aria-hidden="true"]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Enviar mensaje' })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
      await expectNoAxeViolations(container);
    });

    it('closes the panel with Escape and returns the focus to the launcher', async () => {
      const user = userEvent.setup();
      renderWithProviders(<Diango />);

      await user.click(launcher());
      expect(screen.getByRole('dialog', { name: 'Diango' })).toBeInTheDocument();
      await user.keyboard('{Escape}');

      expect(screen.queryByRole('dialog', { name: 'Diango' })).not.toBeInTheDocument();
      expect(launcher()).toHaveFocus();
    });
  });
});
