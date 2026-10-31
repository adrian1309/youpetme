import { act, render, renderHook, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

import { AuthProvider } from './auth-provider';
import { useAuth, type AuthSession } from './auth-state';

const session: AuthSession = {
  accessToken: 'access-token-value',
  user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
};

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

describe('AuthProvider (ADR-002: access token in memory only)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('starts unauthenticated', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.session).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('keeps the session after signIn and exposes the user', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

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
      <AuthProvider>
        <Greeting />
        <SignInButton />
      </AuthProvider>,
    );

    expect(screen.getByText('visitor')).toBeInTheDocument();
    act(() => screen.getByRole('button', { name: 'sign in' }).click());
    expect(screen.getByText('John')).toBeInTheDocument();
  });

  it('never writes the token to localStorage or sessionStorage, nor to cookies', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const { result } = renderHook(() => useAuth(), { wrapper });

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
