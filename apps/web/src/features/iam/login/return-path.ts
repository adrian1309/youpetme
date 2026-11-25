/**
 * Where to go after signing in: the `from` path another page put in the /login location state
 * (e.g. an animal page, SCRUM-14), or the home. Only same-app paths are accepted, never `//host`.
 */
export function returnPath(state: unknown): string {
  const from = (state as { from?: unknown } | null)?.from;
  return typeof from === 'string' && from.startsWith('/') && !from.startsWith('//') ? from : '/';
}
