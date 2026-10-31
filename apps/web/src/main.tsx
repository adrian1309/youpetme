import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { createApiClient } from './lib/http/api-client';
import { readApiUrl } from './lib/http/config';
import './lib/i18n';
import './styles/global.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

const apiClient = createApiClient({ baseUrl: readApiUrl(import.meta.env) });

createRoot(rootElement).render(
  <StrictMode>
    <App apiClient={apiClient} />
  </StrictMode>,
);
