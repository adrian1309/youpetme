import { createContext, useContext } from 'react';

import type { AuthStatus, SignInOptions } from './session-manager';

export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface AuthSession {
  /** Short-lived access token. Held in memory only, never in web storage (ADR-002). */
  accessToken: string;
  user: AuthUser;
}

export interface AuthContextValue {
  /** `restoring` while the start-up refresh is in flight (TS-IAM-002). */
  status: AuthStatus;
  session: AuthSession | null;
  isAuthenticated: boolean;
  /** The session ended while in use: the app sends the user to /login. */
  expired: boolean;
  /** Signed in by a registration just completed (not by login or a restored session). */
  accountCreated: boolean;
  signIn(session: AuthSession, options?: SignInOptions): void;
  /** Runs a request with the access token, renewing the session once on a 401. */
  authorized<T>(request: (accessToken: string) => Promise<T>): Promise<T>;
  acknowledgeExpiry(): void;
  /** Logs out (TS-IAM-003); the client state is always cleared. Never throws. */
  signOut(): Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
