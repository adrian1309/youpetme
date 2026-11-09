import { useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';

import { useApiClient } from '../../../lib/http/api-client-context';
import { AuthContext, type AuthContextValue } from './auth-state';
import { AUTH_CHANNEL_NAME, createSessionManager, type SessionManager } from './session-manager';

/**
 * Authentication state for the web app (ADR-004: React state, no global store). The refresh
 * token travels in an HttpOnly cookie the frontend never reads; on start-up the session is
 * restored from it (TS-IAM-002). `manager` is injectable so tests can start as a visitor.
 */
export function AuthProvider({
  children,
  manager: injected,
}: {
  children: ReactNode;
  manager?: SessionManager;
}) {
  const client = useApiClient();
  const [manager] = useState(() => injected ?? createSessionManager({ client }));
  const state = useSyncExternalStore(manager.subscribe, manager.getState);

  useEffect(() => {
    void manager.restore();
  }, [manager]);

  // A logout in another tab signs this one out too (L4). Where BroadcastChannel is missing, this
  // tab simply falls back to visitor on its next refresh.
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    return manager.connectTabs(new BroadcastChannel(AUTH_CHANNEL_NAME));
  }, [manager]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status: state.status,
      session: state.session,
      isAuthenticated: state.status === 'authenticated',
      expired: state.expired,
      accountCreated: state.accountCreated === true,
      signIn: manager.signIn,
      authorized: manager.authorized,
      acknowledgeExpiry: manager.acknowledgeExpiry,
      signOut: manager.signOut,
    }),
    [state, manager],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
