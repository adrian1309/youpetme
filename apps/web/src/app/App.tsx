import { BrowserRouter } from 'react-router';

import type { ApiClient } from '../lib/http/api-client';
import { AppProviders } from './AppProviders';
import { AppRoutes } from './AppRoutes';

export function App({ apiClient }: { apiClient: ApiClient }) {
  return (
    <AppProviders client={apiClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  );
}
