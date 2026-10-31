import type { ReactNode } from 'react';

import type { ApiClient } from './api-client';
import { ApiClientContext } from './api-client-context';

/** Makes the API client injectable, so tests can pass one backed by a fake fetch. */
export function ApiClientProvider({
  client,
  children,
}: {
  client: ApiClient;
  children: ReactNode;
}) {
  return <ApiClientContext.Provider value={client}>{children}</ApiClientContext.Provider>;
}
