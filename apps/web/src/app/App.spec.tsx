import { render, screen } from '@testing-library/react';

import { createApiClient } from '../lib/http/api-client';
import { App } from './App';

describe('App', () => {
  it('renders the YouPetMe application shell for a visitor once no session can be restored', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ statusCode: 401, error: 'x', message: 'x' }), {
        status: 401,
      }),
    );
    render(<App apiClient={createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock })} />);

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: '¿Listo para encontrar a tu mejor amigo?',
      }),
    ).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]![0]).toBe('http://api.test/api/v1/auth/refresh');
    expect(screen.getByRole('link', { name: 'Registrarse' })).toBeInTheDocument();
  });
});
