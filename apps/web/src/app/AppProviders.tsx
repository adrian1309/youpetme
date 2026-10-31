import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

import { AuthProvider } from '../features/iam/auth/auth-provider';
import type { ApiClient } from '../lib/http/api-client';
import { ApiClientProvider } from '../lib/http/ApiClientProvider';

/** Server state (TanStack Query, ADR-004), the API client and the in-memory auth state. */
export function AppProviders({ client, children }: { client: ApiClient; children: ReactNode }) {
  const [queryClient] = useState(
    () => new QueryClient({ defaultOptions: { mutations: { retry: false } } }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ApiClientProvider client={client}>
        <AuthProvider>{children}</AuthProvider>
      </ApiClientProvider>
    </QueryClientProvider>
  );
}
