import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { createApiClient } from '../lib/http/api-client';
import { readApiUrl } from '../lib/http/config';
import '../lib/i18n';
import { App } from './App';
import { ConfigurationErrorScreen } from './ConfigurationErrorScreen';

type StartEnv = Parameters<typeof readApiUrl>[0];

/**
 * Renders the app into `rootElement`. If the configuration is invalid it renders a visible
 * error screen instead, so a bad deployment is never a blank page.
 */
export function startApp(rootElement: HTMLElement, env: StartEnv): void {
  const root = createRoot(rootElement);

  let apiClient;
  try {
    apiClient = createApiClient({ baseUrl: readApiUrl(env) });
  } catch (error) {
    console.error(error);
    root.render(
      <StrictMode>
        <ConfigurationErrorScreen />
      </StrictMode>,
    );
    return;
  }

  root.render(
    <StrictMode>
      <App apiClient={apiClient} />
    </StrictMode>,
  );
}
