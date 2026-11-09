import { ApiError, NetworkError } from './api-error';
import { createApiClient } from './api-client';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createApiClient', () => {
  it('POSTs JSON with credentials so the HttpOnly refresh cookie is accepted', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(201, { ok: true }));
    const client = createApiClient({ baseUrl: 'http://localhost:3000', fetch: fetchMock });

    await client.post('/api/v1/auth/register', { email: 'john@example.com' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('http://localhost:3000/api/v1/auth/register');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ email: 'john@example.com' }),
    });
    expect(new Headers(init.headers).get('Content-Type')).toBe('application/json');
    expect(new Headers(init.headers).get('Accept')).toBe('application/json');
  });

  it('does not double the slash when the base URL ends with one', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, {}));
    const client = createApiClient({ baseUrl: 'http://localhost:3000/', fetch: fetchMock });

    await client.post('/api/v1/x', {});

    expect(fetchMock.mock.calls[0]![0]).toBe('http://localhost:3000/api/v1/x');
  });

  it('returns the parsed body of a successful response', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: vi.fn().mockResolvedValue(jsonResponse(201, { user: { id: '1' } })),
    });

    await expect(client.post('/x', {})).resolves.toEqual({ user: { id: '1' } });
  });

  it('throws ApiError with the status and the structured error body', async () => {
    const body = {
      statusCode: 400,
      error: 'Bad Request',
      message: 'Validation failed',
      details: [{ field: 'email', code: 'REQUIRED', message: 'This field is required' }],
    };
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: vi.fn().mockResolvedValue(jsonResponse(400, body)),
    });

    const error = await client.post('/x', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).body).toEqual(body);
  });

  it('throws ApiError without a body when the error response is not JSON', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: vi.fn().mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 })),
    });

    const error = await client.post('/x', {}).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(502);
    expect((error as ApiError).body).toBeUndefined();
  });

  it('throws NetworkError when the request cannot be made', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    });

    await expect(client.post('/x', {})).rejects.toBeInstanceOf(NetworkError);
  });

  describe('get', () => {
    it('GETs with credentials and without a body, and returns the parsed response', async () => {
      const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { version: '2026-01' }));
      const client = createApiClient({ baseUrl: 'http://localhost:3000/', fetch: fetchMock });

      await expect(client.get('/api/v1/legal/terms-version')).resolves.toEqual({
        version: '2026-01',
      });

      const [url, init] = fetchMock.mock.calls[0]!;
      expect(url).toBe('http://localhost:3000/api/v1/legal/terms-version');
      expect(init).toMatchObject({ method: 'GET', credentials: 'include' });
      expect(init.body).toBeUndefined();
      expect(new Headers(init.headers).get('Accept')).toBe('application/json');
      expect(new Headers(init.headers).has('Content-Type')).toBe(false);
    });

    it('throws ApiError on an error status and NetworkError when the request cannot be made', async () => {
      const failing = createApiClient({
        baseUrl: 'http://api',
        fetch: vi.fn().mockResolvedValue(jsonResponse(500, { message: 'x' })),
      });
      const offline = createApiClient({
        baseUrl: 'http://api',
        fetch: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
      });

      const error = await failing.get('/x').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(500);
      await expect(offline.get('/x')).rejects.toBeInstanceOf(NetworkError);
    });
  });

  it('never puts the request body or response details in error messages', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: vi.fn().mockResolvedValue(jsonResponse(409, { message: 'secret-detail' })),
    });

    const error = (await client
      .post('/x', { password: 'my-secure-passphrase' })
      .catch((e: unknown) => e)) as ApiError;

    expect(error.message).not.toContain('my-secure-passphrase');
    expect(error.message).not.toContain('secret-detail');
  });
});

describe('createApiClient — bodiless POST and bearer token (TS-IAM-002)', () => {
  it('POSTs without a body or Content-Type when no body is given', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(200, { ok: true }));
    const client = createApiClient({ baseUrl: 'http://api', fetch: fetchMock });

    await client.post('/api/v1/auth/refresh');

    const [, init] = fetchMock.mock.calls[0]!;
    expect(init).toMatchObject({ method: 'POST', credentials: 'include' });
    expect(init.body).toBeUndefined();
    expect(new Headers(init.headers).has('Content-Type')).toBe(false);
  });

  it('sends the access token as a Bearer Authorization header when given one', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const client = createApiClient({ baseUrl: 'http://api', fetch: fetchMock });

    await client.get('/x', { accessToken: 'token-1' });
    await client.post('/y', { a: 1 }, { accessToken: 'token-2' });
    await client.get('/z');

    const header = (call: number) =>
      new Headers(fetchMock.mock.calls[call]![1].headers).get('Authorization');
    expect(header(0)).toBe('Bearer token-1');
    expect(header(1)).toBe('Bearer token-2');
    expect(header(2)).toBeNull();
  });
});

describe('createApiClient — cancellation', () => {
  it('passes the AbortSignal to fetch, so a request can be cancelled', async () => {
    const fetchMock = vi.fn().mockImplementation(() => Promise.resolve(jsonResponse(200, {})));
    const client = createApiClient({ baseUrl: 'http://api', fetch: fetchMock });
    const controller = new AbortController();

    await client.post('/x', undefined, { signal: controller.signal });
    await client.get('/y', { signal: controller.signal });

    expect(fetchMock.mock.calls[0]![1].signal).toBe(controller.signal);
    expect(fetchMock.mock.calls[1]![1].signal).toBe(controller.signal);
  });

  it('reports a cancelled request as a NetworkError', async () => {
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) =>
          init.signal!.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          ),
        ),
    );
    const client = createApiClient({
      baseUrl: 'http://api',
      fetch: fetchMock as unknown as typeof fetch,
    });
    const controller = new AbortController();

    const pending = client.post('/x', undefined, { signal: controller.signal });
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(NetworkError);
  });
});
