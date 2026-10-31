import { useMemo, useState, type ReactNode } from 'react';

import { AuthContext, type AuthContextValue, type AuthSession } from './auth-state';

/**
 * Authentication state for the web app (ADR-004: React state, no global store). The refresh
 * token travels in an HttpOnly cookie the frontend never reads. A page reload drops this state;
 * restoring it needs the refresh endpoint (SCRUM-6), which is out of scope here.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({ session, isAuthenticated: session !== null, signIn: setSession }),
    [session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
