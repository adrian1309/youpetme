/** Where an ADMIN lands after signing in when no page sent them to /login (SCRUM-56). */
export const ADMIN_HOME = '/admin';

/**
 * Where to go after signing in: the `from` path another page put in the /login location state
 * (e.g. an animal page, SCRUM-14); otherwise the admin panel for an ADMIN, or the home. Only
 * same-app paths are accepted, never `//host`.
 */
export function returnPath(state: unknown, role?: string): string {
  const from = (state as { from?: unknown } | null)?.from;
  if (typeof from === 'string' && from.startsWith('/') && !from.startsWith('//')) return from;
  return role === 'ADMIN' ? ADMIN_HOME : '/';
}
