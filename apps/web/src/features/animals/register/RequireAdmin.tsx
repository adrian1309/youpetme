import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import { useAuth } from '../../iam/auth/auth-state';

/**
 * UX only: visitors go to the login page and non-admins to the catalogue. The API rejects a
 * non-ADMIN on its own (403); this never replaces that check (AGENTS.md — Architecture rules).
 */
export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session } = useAuth();
  if (!session) return <Navigate to="/login" replace />;
  if (session.user.role !== 'ADMIN') return <Navigate to="/animals" replace />;
  return children;
}
