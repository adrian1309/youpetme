import { render, screen } from '@testing-library/react';

import { createApiClient } from '../lib/http/api-client';
import { App } from './App';

describe('App', () => {
  it('renders the YouPetMe application shell for a visitor', () => {
    render(<App apiClient={createApiClient({ baseUrl: 'http://api.test', fetch: vi.fn() })} />);

    expect(screen.getByRole('heading', { level: 1, name: 'YouPetMe' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Crear cuenta' })).toBeInTheDocument();
  });
});
