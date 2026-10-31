import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router';

import { AuthProvider } from '../features/iam/auth/auth-provider';
import { createApiClient } from '../lib/http/api-client';
import { ApiClientProvider } from '../lib/http/ApiClientProvider';
import '../lib/i18n';

export const TEST_API_URL = 'http://api.test';

export function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface Options {
  /** The fake fetch behind the API client. */
  fetch?: typeof fetch;
  initialEntries?: string[];
}

/** Renders `ui` with the same providers as the app, but with a router in memory and a fake API. */
export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const client = createApiClient({
    baseUrl: TEST_API_URL,
    fetch: options.fetch ?? (() => Promise.reject(new TypeError('no fake fetch configured'))),
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={client}>
        <AuthProvider>
          <MemoryRouter initialEntries={options.initialEntries ?? ['/']}>{ui}</MemoryRouter>
        </AuthProvider>
      </ApiClientProvider>
    </QueryClientProvider>,
  );
}
