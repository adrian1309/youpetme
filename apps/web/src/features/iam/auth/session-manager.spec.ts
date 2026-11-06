import type { RefreshResponse } from '@youpetme/contracts';

import { createApiClient } from '../../../lib/http/api-client';
import { ApiError, NetworkError } from '../../../lib/http/api-error';
import { jsonResponse } from '../../../test/render-with-providers';
import type { AuthSession } from './auth-state';
import { createSessionManager, REFRESH_LOCK_NAME, REFRESH_PATH } from './session-manager';

const API = 'http://api.test';

function refreshed(accessToken: string, firstName = 'John'): RefreshResponse {
  return {
    user: { id: 'u-1', firstName, lastName: 'Doe', email: 'john@example.com', status: 'ACTIVE' },
    authentication: { accessToken },
  };
}

const notRenewable = () =>
  jsonResponse(401, {
    statusCode: 401,
    error: 'Unauthorized',
    message: 'The session could not be renewed',
    code: 'SESSION_NOT_RENEWABLE',
  });

const signedIn: AuthSession = {
  accessToken: 'old-token',
  user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
};

/** A fetch that answers each call with the next response factory. */
function sequence(...responses: (() => Response | Promise<Response>)[]) {
  return vi.fn<typeof fetch>(() => {
    const next = responses.shift();
    if (!next) throw new Error('unexpected request');
    return Promise.resolve(next());
  });
}

function setup(fetchMock: ReturnType<typeof sequence>, options = {}) {
  const client = createApiClient({ baseUrl: API, fetch: fetchMock });
  return createSessionManager({ client, locks: null, ...options });
}

/** In-memory Web Locks: exclusive, first come first served, like navigator.locks. */
function fakeLocks() {
  let tail = Promise.resolve();
  const requested: string[] = [];
  return {
    requested,
    request<T>(name: string, callback: () => Promise<T>): Promise<T> {
      requested.push(name);
      const run = tail.then(callback);
      tail = run.then(
        () => undefined,
        () => undefined,
      );
      return run;
    },
  };
}

describe('SessionManager (TS-IAM-002, ADR-002)', () => {
  describe('Scenario 5 — restoring the session when the app starts or reloads', () => {
    it('starts restoring, calls refresh once and becomes authenticated with the user', async () => {
      const fetchMock = sequence(() => jsonResponse(200, refreshed('new-token')));
      const manager = setup(fetchMock);

      expect(manager.getState().status).toBe('restoring');
      await manager.restore();

      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe(`${API}${REFRESH_PATH}`);
      expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
      expect(manager.getState()).toEqual({
        status: 'authenticated',
        session: {
          accessToken: 'new-token',
          user: { id: 'u-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        },
        expired: false,
      });
    });

    it('sends a single refresh even when restore is called twice at once (React StrictMode)', async () => {
      const fetchMock = sequence(() => jsonResponse(200, refreshed('new-token')));
      const manager = setup(fetchMock);

      await Promise.all([manager.restore(), manager.restore()]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('does nothing when it does not start in the restoring state', async () => {
      const fetchMock = sequence();
      const manager = setup(fetchMock, { initialStatus: 'anonymous' });

      await manager.restore();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(manager.getState().status).toBe('anonymous');
    });

    it('notifies subscribers of each change', async () => {
      const manager = setup(sequence(() => jsonResponse(200, refreshed('t'))));
      const listener = vi.fn();
      const unsubscribe = manager.subscribe(listener);

      await manager.restore();
      unsubscribe();
      manager.signIn(signedIn);

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('Scenario 6 — a session that cannot be renewed when the app starts', () => {
    it.each([
      ['401', notRenewable],
      ['403', () => jsonResponse(403, { statusCode: 403, error: 'Forbidden', message: 'x' })],
      ['a server error', () => jsonResponse(500, { statusCode: 500, error: 'x', message: 'x' })],
      ['a network error', () => Promise.reject(new TypeError('Failed to fetch'))],
    ])('becomes a visitor without an error after %s', async (_case, response) => {
      const manager = setup(sequence(response));

      await expect(manager.restore()).resolves.toBeUndefined();

      expect(manager.getState()).toEqual({ status: 'anonymous', session: null, expired: false });
    });
  });

  describe('signIn', () => {
    it('stores the session in memory only', () => {
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const manager = setup(sequence(), { initialStatus: 'anonymous' });

      manager.signIn(signedIn);

      expect(manager.getState()).toEqual({
        status: 'authenticated',
        session: signedIn,
        expired: false,
      });
      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });
  });

  describe('signIn after a registration', () => {
    it('flags the session as just created, and a later login does not', () => {
      const manager = setup(sequence(), { initialStatus: 'anonymous' });

      manager.signIn(signedIn, { accountCreated: true });
      expect(manager.getState().accountCreated).toBe(true);

      manager.signIn(signedIn);
      expect(manager.getState().accountCreated).toBeUndefined();
    });
  });

  describe('authorized requests', () => {
    function signedInManager(fetchMock: ReturnType<typeof sequence>) {
      const manager = setup(fetchMock, { initialStatus: 'anonymous' });
      manager.signIn(signedIn);
      return manager;
    }

    it('passes the current access token to the request', async () => {
      const manager = signedInManager(sequence());
      const request = vi.fn().mockResolvedValue('result');

      await expect(manager.authorized(request)).resolves.toBe('result');
      expect(request).toHaveBeenCalledWith('old-token');
    });

    it('Scenario 5 — after a 401 it refreshes once and retries once with the new token', async () => {
      const fetchMock = sequence(() => jsonResponse(200, refreshed('new-token')));
      const manager = signedInManager(fetchMock);
      const request = vi
        .fn()
        .mockRejectedValueOnce(new ApiError(401))
        .mockResolvedValueOnce('result');

      await expect(manager.authorized(request)).resolves.toBe('result');

      expect(request.mock.calls).toEqual([['old-token'], ['new-token']]);
      expect(manager.getState().session?.accessToken).toBe('new-token');
    });

    it('never retries more than once', async () => {
      const manager = signedInManager(sequence(() => jsonResponse(200, refreshed('new-token'))));
      const request = vi.fn().mockRejectedValue(new ApiError(401));

      await expect(manager.authorized(request)).rejects.toBeInstanceOf(ApiError);
      expect(request).toHaveBeenCalledTimes(2);
    });

    it('concurrent requests that get a 401 share a single refresh', async () => {
      const fetchMock = sequence(() => jsonResponse(200, refreshed('new-token')));
      const manager = signedInManager(fetchMock);
      const request = (token: string) =>
        token === 'old-token' ? Promise.reject(new ApiError(401)) : Promise.resolve(token);

      const results = await Promise.all([
        manager.authorized(request),
        manager.authorized(request),
        manager.authorized(request),
      ]);

      expect(results).toEqual(['new-token', 'new-token', 'new-token']);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('Scenario 6 — when the refresh is rejected it signs out and flags the session as expired', async () => {
      const manager = signedInManager(sequence(notRenewable));
      const request = vi.fn().mockRejectedValue(new ApiError(401));

      await expect(manager.authorized(request)).rejects.toBeInstanceOf(ApiError);

      expect(request).toHaveBeenCalledTimes(1);
      expect(manager.getState()).toEqual({ status: 'anonymous', session: null, expired: true });
      manager.acknowledgeExpiry();
      expect(manager.getState().expired).toBe(false);
    });

    it('keeps the session when the refresh cannot reach the server', async () => {
      const manager = signedInManager(sequence(() => Promise.reject(new TypeError('offline'))));

      await expect(
        manager.authorized(() => Promise.reject(new ApiError(401))),
      ).rejects.toBeInstanceOf(NetworkError);

      expect(manager.getState().status).toBe('authenticated');
    });

    it('does not refresh for errors other than 401', async () => {
      const fetchMock = sequence();
      const manager = signedInManager(fetchMock);

      await expect(
        manager.authorized(() => Promise.reject(new ApiError(403))),
      ).rejects.toBeInstanceOf(ApiError);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('refuses to run without a session', async () => {
      const manager = setup(sequence(), { initialStatus: 'anonymous' });
      const request = vi.fn();

      await expect(manager.authorized(request)).rejects.toBeInstanceOf(ApiError);
      expect(request).not.toHaveBeenCalled();
    });
  });

  describe('several tabs (Web Locks)', () => {
    it('runs every refresh inside the shared lock', async () => {
      const locks = fakeLocks();
      const manager = setup(
        sequence(() => jsonResponse(200, refreshed('t'))),
        { locks },
      );

      await manager.restore();

      expect(locks.requested).toEqual([REFRESH_LOCK_NAME]);
    });

    it('lets two tabs refresh one after the other, so the second one sends the rotated cookie', async () => {
      const locks = fakeLocks();
      // The browser's cookie jar, shared by both tabs: each refresh rotates it.
      let cookie = 'cookie-1';
      const sent: string[] = [];
      const fetchMock = vi.fn(async () => {
        const presented = cookie;
        sent.push(presented);
        await new Promise((resolve) => setTimeout(resolve, 5));
        if (presented !== cookie) return notRenewable();
        cookie = `${presented}+`;
        return jsonResponse(200, refreshed(`token-for-${presented}`));
      });
      const tab = () =>
        createSessionManager({
          client: createApiClient({ baseUrl: API, fetch: fetchMock }),
          locks,
        });
      const [first, second] = [tab(), tab()];

      await Promise.all([first.restore(), second.restore()]);

      expect(sent).toEqual(['cookie-1', 'cookie-1+']);
      expect(first.getState().status).toBe('authenticated');
      expect(second.getState().status).toBe('authenticated');
    });
  });
});
