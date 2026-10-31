import { act, screen, waitFor } from '@testing-library/react';

import { expectNoAxeViolations } from '../test/axe';
import { startApp } from './start-app';

let container: HTMLElement;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
  vi.restoreAllMocks();
});

async function start(env: Parameters<typeof startApp>[1]) {
  await act(async () => {
    startApp(container, env);
  });
}

describe('startApp', () => {
  describe('when VITE_API_URL is missing in a production build', () => {
    it('shows a visible, translated message instead of a blank page', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await start({ DEV: false });

      expect(
        screen.getByRole('heading', { level: 1, name: 'No se puede iniciar la aplicación' }),
      ).toBeVisible();
      expect(
        screen.getByText(
          'La configuración de esta versión no es correcta. Quien administra la aplicación debe revisar la variable VITE_API_URL.',
        ),
      ).toBeVisible();
      await waitFor(() =>
        expect(document.title).toBe('No se puede iniciar la aplicación · YouPetMe'),
      );
    });

    it('announces the problem to assistive technology', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await start({ DEV: false });

      expect(screen.getByRole('alert')).toHaveTextContent('VITE_API_URL');
    });

    it('logs the technical reason to the console, but never shows it on screen', async () => {
      const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await start({ DEV: false });

      expect(error).toHaveBeenCalledTimes(1);
      expect(String(error.mock.calls[0]![0])).toContain('VITE_API_URL is not set');
      expect(container).not.toHaveTextContent('is not set');
    });

    it('has no accessibility violations', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);

      await start({ DEV: false });

      await expectNoAxeViolations(container, { page: true });
    });
  });

  it('shows the same screen for a malformed VITE_API_URL', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await start({ DEV: true, VITE_API_URL: 'not a url' });

    expect(
      screen.getByRole('heading', { level: 1, name: 'No se puede iniciar la aplicación' }),
    ).toBeVisible();
  });

  it('starts the application in development without any configuration', async () => {
    await start({ DEV: true });

    expect(screen.getByRole('heading', { level: 1, name: 'YouPetMe' })).toBeVisible();
    expect(screen.queryByText('No se puede iniciar la aplicación')).not.toBeInTheDocument();
  });

  it('starts the application in production when VITE_API_URL is set', async () => {
    await start({ DEV: false, VITE_API_URL: 'https://api.example.com' });

    expect(screen.getByRole('heading', { level: 1, name: 'YouPetMe' })).toBeVisible();
  });
});
