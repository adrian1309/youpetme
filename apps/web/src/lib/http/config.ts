/** Reads and validates the API origin the web app talks to (VITE_API_URL). */
export function readApiUrl(env: { VITE_API_URL?: string }): string {
  const value = env.VITE_API_URL?.trim();
  if (!value) {
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
