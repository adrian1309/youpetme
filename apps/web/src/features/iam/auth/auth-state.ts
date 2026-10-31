import { createContext, useContext } from 'react';

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
  session: AuthSession | null;
  isAuthenticated: boolean;
  signIn(session: AuthSession): void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider');
  }
  return context;
}
