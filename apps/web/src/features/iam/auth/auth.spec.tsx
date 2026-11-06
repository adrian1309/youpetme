import type { RefreshResponse } from '@youpetme/contracts';
import { act, render, renderHook, screen, waitFor } from '@testing-library/react';
import { StrictMode, type ReactNode } from 'react';

import { createApiClient } from '../../../lib/http/api-client';
import { ApiClientProvider } from '../../../lib/http/ApiClientProvider';
import { jsonResponse } from '../../../test/render-with-providers';
import { AuthProvider } from './auth-provider';
import { useAuth, type AuthSession } from './auth-state';
import { createSessionManager } from './session-manager';

const session: AuthSession = {
  accessToken: 'access-token-value',
  user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
};

const refreshed: RefreshResponse = {
  user: {
    id: 'u-1',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    status: 'ACTIVE',
  },
  authentication: { accessToken: 'restored-token' },
};

function clientWith(fetchMock: typeof fetch) {
  return createApiClient({ baseUrl: 'http://api.test', fetch: fetchMock });
}

/** A visitor's provider: no restoration, as in most page tests. */
function visitorWrapper({ children }: { children: ReactNode }) {
  const client = clientWith(vi.fn());
  const manager = createSessionManager({ client, locks: null, initialStatus: 'anonymous' });
  return (
    <ApiClientProvider client={client}>
      <AuthProvider manager={manager}>{children}</AuthProvider>
    </ApiClientProvider>
  );
}

describe('AuthProvider (ADR-002: access token in memory only)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  describe('restoring the session on start-up (US-IAM-002, scenarios 5 and 6)', () => {
    function restoringWrapper(fetchMock: typeof fetch) {
      return function Wrapper({ children }: { children: ReactNode }) {
        return (
          <StrictMode>
            <ApiClientProvider client={clientWith(fetchMock)}>
              <AuthProvider>{children}</AuthProvider>
            </ApiClientProvider>
          </StrictMode>
        );
      };
    }

    it('starts restoring and, with a valid refresh cookie, ends authenticated with the user', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, refreshed));
      const { result } = renderHook(() => useAuth(), { wrapper: restoringWrapper(fetchMock) });

      expect(result.current.status).toBe('restoring');
      await waitFor(() => expect(result.current.status).toBe('authenticated'));

      expect(result.current.session).toEqual({
        accessToken: 'restored-token',
        user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      });
    });

    it('sends a single refresh even under StrictMode, which runs effects twice', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, refreshed));
      const { result } = renderHook(() => useAuth(), { wrapper: restoringWrapper(fetchMock) });

      await waitFor(() => expect(result.current.status).toBe('authenticated'));
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('ends as a visitor, without an error, when the refresh is rejected', async () => {
      const fetchMock = vi
        .fn()
        .mockResolvedValue(jsonResponse(401, { statusCode: 401, error: 'x', message: 'x' }));
      const { result } = renderHook(() => useAuth(), { wrapper: restoringWrapper(fetchMock) });

      await waitFor(() => expect(result.current.status).toBe('anonymous'));
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.expired).toBe(false);
    });
  });

  it('starts unauthenticated when given a visitor session manager', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: visitorWrapper });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('keeps the session after signIn and exposes the user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: visitorWrapper });

    act(() => result.current.signIn(session));

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.session?.user.firstName).toBe('John');
    expect(result.current.session?.accessToken).toBe('access-token-value');
  });

  it('re-renders consumers when the session changes', () => {
    function Greeting() {
      const { session: current } = useAuth();
      return <p>{current ? current.user.firstName : 'visitor'}</p>;
    }
    function SignInButton() {
      const { signIn } = useAuth();
      return <button onClick={() => signIn(session)}>sign in</button>;
    }
    render(
      <>
        <Greeting />
        <SignInButton />
      </>,
      { wrapper: visitorWrapper },
    );

    expect(screen.getByText('visitor')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('never writes the token to localStorage or sessionStorage, nor to cookies', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useAuth(), { wrapper: visitorWrapper });

    act(() => result.current.signIn(session));

    expect(local).not.toHaveBeenCalled();
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
    expect(document.cookie).not.toContain('access-token-value');
  });

  it('fails clearly when used outside the provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(() => renderHook(() => useAuth())).toThrow('AuthProvider');
  });
});
