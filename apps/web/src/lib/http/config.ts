/** Where the API listens in local development (API_PORT in .env.example). */
const DEVELOPMENT_API_URL = 'http://localhost:3000';

interface ApiUrlEnv {
  VITE_API_URL?: string;
  /** `import.meta.env.DEV`: true only for the Vite dev server, never in a production build. */
  DEV?: boolean;
}

/**
 * Reads and validates the API origin the web app talks to (VITE_API_URL). In development it
 * defaults to the local API; in production it is mandatory, so a deployment can never silently
 * point at localhost.
 */
export function readApiUrl(env: ApiUrlEnv): string {
  const value = env.VITE_API_URL?.trim();
  if (!value) {
    if (env.DEV === true) {
      return DEVELOPMENT_API_URL;
    }
    throw new Error('VITE_API_URL is not set (see .env.example)');
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('VITE_API_URL is not a valid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('VITE_API_URL must be an http or https URL');
  }
  return value.replace(/\/+$/, '');
}
