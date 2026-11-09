import type { RefreshResponse } from '@youpetme/contracts';

import type { ApiClient } from '../../../lib/http/api-client';
import { ApiError } from '../../../lib/http/api-error';
import type { AuthSession } from './auth-state';

export const REFRESH_PATH = '/api/v1/auth/refresh';
export const LOGOUT_PATH = '/api/v1/auth/logout';
/**
 * How long a logout waits for the server before signing out anyway (US-IAM-003, scenario 3). A
 * dead network can take far longer to fail on its own.
 */
export const LOGOUT_TIMEOUT_MS = 5_000;
/** Name of the BroadcastChannel the tabs of the app use to tell each other about a logout. */
export const AUTH_CHANNEL_NAME = 'youpetme:auth';
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

/** The subset of BroadcastChannel this module needs, so tests can pass an in-memory one. */
export interface AuthChannel {
  postMessage(message: unknown): void;
  addEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEvent) => void): void;
  close(): void;
}

const SIGNED_OUT_MESSAGE = { type: 'signed-out' } as const;

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
  /**
   * Logs out (TS-IAM-003): asks the API to revoke the session, then always clears the client
   * state, whatever the answer, even without a network. Never throws.
   */
  signOut(): Promise<void>;
  /**
   * Joins the other tabs of the app (decision L4): a logout here signs them out at once. Returns
   * a function that leaves the channel and closes it.
   */
  connectTabs(channel: AuthChannel): () => void;
}

export interface SessionManagerOptions {
  client: ApiClient;
  /** Defaults to navigator.locks when the browser has it; null runs refreshes unlocked. */
  locks?: RefreshLocks | null;
  initialStatus?: Extract<AuthStatus, 'restoring' | 'anonymous'>;
  /** Defaults to LOGOUT_TIMEOUT_MS; tests shorten it. */
  logoutTimeoutMs?: number;
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
 * A logout in one tab is broadcast to the others (TS-IAM-003, decision L4).
 */
export function createSessionManager({
  client,
  locks = defaultLocks(),
  initialStatus = 'restoring',
  logoutTimeoutMs = LOGOUT_TIMEOUT_MS,
}: SessionManagerOptions): SessionManager {
  let state: AuthState = { status: initialStatus, session: null, expired: false };
  const listeners = new Set<() => void>();
  let refreshInFlight: Promise<RefreshOutcome> | null = null;
  let restoreInFlight: Promise<void> | null = null;
  let signOutInFlight: Promise<void> | null = null;
  let tabs: AuthChannel | null = null;

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

  /**
   * Runs `request` with the access token, renewing the session once on a 401. `flagExpiry` says
   * whether a rejected renewal flags an expiry (redirect to /login): yes during use; not during a
   * logout, which clears the state anyway.
   */
  async function withAccessToken<T>(
    request: (accessToken: string) => Promise<T>,
    flagExpiry: boolean,
  ): Promise<T> {
    const token = state.session?.accessToken;
    if (!token) throw new ApiError(401);
    try {
      return await request(token);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status !== 401) throw error;
      const outcome = await refresh();
      if (outcome.kind === 'failed') throw outcome.error;
      if (outcome.kind === 'rejected') {
        if (state.session) setState({ status: 'anonymous', session: null, expired: flagExpiry });
        throw error;
      }
      // Signed out while the renewal was in flight: it must not bring the session back.
      if (!state.session) throw error;
      if (state.session.accessToken !== outcome.session.accessToken) {
        setState({ ...state, status: 'authenticated', session: outcome.session });
      }
      return request(outcome.session.accessToken);
    }
  }

  function signOutLocally(): void {
    if (state.status !== 'anonymous' || state.session || state.expired) {
      setState({ status: 'anonymous', session: null, expired: false });
    }
  }

  async function requestSignOut(): Promise<void> {
    const cancel = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      if (state.session) {
        const attempt = withAccessToken(
          (accessToken) =>
            client.post<unknown>(LOGOUT_PATH, undefined, { accessToken, signal: cancel.signal }),
          false,
        );
        const timeLimit = new Promise<void>((resolve) => {
          timer = setTimeout(resolve, logoutTimeoutMs);
        });
        // US-IAM-003, scenario 3: the client signs out even if the server cannot be reached,
        // and does not wait longer than the time limit to find out.
        await Promise.race([
          attempt.then(
            () => undefined,
            () => undefined,
          ),
          timeLimit,
        ]);
      }
    } finally {
      clearTimeout(timer);
      cancel.abort();
      signOutLocally();
      tabs?.postMessage(SIGNED_OUT_MESSAGE);
    }
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

    authorized<T>(request: (accessToken: string) => Promise<T>): Promise<T> {
      return withAccessToken(request, true);
    },

    acknowledgeExpiry() {
      if (state.expired) setState({ ...state, expired: false });
    },

    signOut() {
      signOutInFlight ??= requestSignOut().finally(() => {
        signOutInFlight = null;
      });
      return signOutInFlight;
    },

    connectTabs(channel) {
      const onMessage = (event: MessageEvent) => {
        const data: unknown = event.data;
        const isSignOut =
          typeof data === 'object' &&
          data !== null &&
          (data as { type?: unknown }).type === SIGNED_OUT_MESSAGE.type;
        // Another tab logged out: the shared session is gone, so this tab follows at once.
        if (isSignOut && state.session) signOutLocally();
      };
      channel.addEventListener('message', onMessage);
      tabs = channel;
      return () => {
        channel.removeEventListener('message', onMessage);
        channel.close();
        if (tabs === channel) tabs = null;
      };
    },
  };
}
