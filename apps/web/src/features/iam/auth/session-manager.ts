import type { RefreshResponse } from '@youpetme/contracts';

import type { ApiClient } from '../../../lib/http/api-client';
import { ApiError } from '../../../lib/http/api-error';
import type { AuthSession } from './auth-state';

export const REFRESH_PATH = '/api/v1/auth/refresh';
/** Shared by every tab of the app on this origin. */
export const REFRESH_LOCK_NAME = 'youpetme:auth-refresh';

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous';

export interface AuthState {
  status: AuthStatus;
  session: AuthSession | null;
  /** The session was lost while in use (refresh rejected): the UI sends the user to /login. */
  expired: boolean;
  /** The session comes from a registration just completed, so the home can confirm it. */
  accountCreated?: boolean;
}

export interface SignInOptions {
  accountCreated?: boolean;
}

/** The subset of the Web Locks API this module needs (navigator.locks). */
export interface RefreshLocks {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

export interface SessionManager {
  getState(): AuthState;
  subscribe(listener: () => void): () => void;
  signIn(session: AuthSession, options?: SignInOptions): void;
  /** Restores the session from the refresh cookie when the app starts; never throws. */
  restore(): Promise<void>;
  /**
   * Runs a request with the current access token. On a 401 it renews the session once and
   * retries once; if the renewal is rejected, the session ends and is flagged as expired.
   */
  authorized<T>(request: (accessToken: string) => Promise<T>): Promise<T>;
  /** Clears the expired flag once the UI has reacted to it. */
  acknowledgeExpiry(): void;
}

export interface SessionManagerOptions {
  client: ApiClient;
  /** Defaults to navigator.locks when the browser has it; null runs refreshes unlocked. */
  locks?: RefreshLocks | null;
  initialStatus?: Extract<AuthStatus, 'restoring' | 'anonymous'>;
}

type RefreshOutcome =
  | { kind: 'renewed'; session: AuthSession }
  | { kind: 'rejected' }
  | { kind: 'failed'; error: unknown };

function defaultLocks(): RefreshLocks | null {
  return typeof navigator !== 'undefined' && navigator.locks ? navigator.locks : null;
}

/**
 * Owns the in-memory session (ADR-002: the access token never reaches web storage) and its
 * renewal (TS-IAM-002). Refresh tokens rotate and a reused one revokes the session, so two
 * refreshes must never send the same cookie:
 * - within a tab, concurrent callers share the one refresh in flight;
 * - across tabs, refreshes run one at a time under a Web Lock, so a waiting tab sends the cookie
 *   the previous tab's refresh just rotated.
 */
export function createSessionManager({
  client,
  locks = defaultLocks(),
  initialStatus = 'restoring',
}: SessionManagerOptions): SessionManager {
  let state: AuthState = { status: initialStatus, session: null, expired: false };
  const listeners = new Set<() => void>();
  let refreshInFlight: Promise<RefreshOutcome> | null = null;
  let restoreInFlight: Promise<void> | null = null;

  function setState(next: AuthState): void {
    state = next;
    for (const listener of listeners) listener();
  }

  async function requestRefresh(): Promise<RefreshOutcome> {
    try {
      const response = await client.post<RefreshResponse>(REFRESH_PATH);
      const { id, firstName, lastName, email } = response.user;
      return {
        kind: 'renewed',
        session: {
          accessToken: response.authentication.accessToken,
          user: { id, firstName, lastName, email },
        },
      };
    } catch (error) {
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        return { kind: 'rejected' };
      }
      return { kind: 'failed', error };
    }
  }

  function refresh(): Promise<RefreshOutcome> {
    refreshInFlight ??= (
      locks ? locks.request(REFRESH_LOCK_NAME, requestRefresh) : requestRefresh()
    ).finally(() => {
      refreshInFlight = null;
    });
    return refreshInFlight;
  }

  return {
    getState: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    signIn(session, options = {}) {
      setState({
        status: 'authenticated',
        session,
        expired: false,
        ...(options.accountCreated ? { accountCreated: true } : {}),
      });
    },

    restore() {
      if (state.status !== 'restoring') return Promise.resolve();
      restoreInFlight ??= refresh().then((outcome) => {
        setState(
          outcome.kind === 'renewed'
            ? { status: 'authenticated', session: outcome.session, expired: false }
            : { status: 'anonymous', session: null, expired: false },
        );
      });
      return restoreInFlight;
    },

    async authorized<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
      const token = state.session?.accessToken;
      if (!token) throw new ApiError(401);
      try {
        return await request(token);
      } catch (error) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        const outcome = await refresh();
        if (outcome.kind === 'failed') throw outcome.error;
        if (outcome.kind === 'rejected') {
          if (state.session) setState({ status: 'anonymous', session: null, expired: true });
          throw error;
        }
        if (state.session?.accessToken !== outcome.session.accessToken) {
          setState({ ...state, status: 'authenticated', session: outcome.session });
        }
        return request(outcome.session.accessToken);
      }
    },

    acknowledgeExpiry() {
      if (state.expired) setState({ ...state, expired: false });
    },
  };
}
