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
