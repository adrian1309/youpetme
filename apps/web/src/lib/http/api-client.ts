import type { ErrorResponse } from '@youpetme/contracts';

import { ApiError, NetworkError } from './api-error';

export interface ApiClientOptions {
  baseUrl: string;
  /** Injectable for tests; defaults to the global fetch. */
  fetch?: typeof fetch;
}

export interface RequestOptions {
  /** Sent as `Authorization: Bearer …`. Held in memory only (ADR-002). */
  accessToken?: string;
}

export interface ApiClient {
  get<TResponse>(path: string, options?: RequestOptions): Promise<TResponse>;
  /** Without `body`, nothing is sent and no Content-Type is set (e.g. the refresh request). */
  post<TResponse>(path: string, body?: unknown, options?: RequestOptions): Promise<TResponse>;
}

function headersFor(options: RequestOptions, json: boolean): Record<string, string> {
  return {
    Accept: 'application/json',
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
  };
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Minimal JSON client. `credentials: 'include'` lets the browser store and send the HttpOnly
 * refresh-token cookie; this code never reads or writes it, and never logs bodies.
 */
export function createApiClient({ baseUrl, fetch: fetchImpl }: ApiClientOptions): ApiClient {
  const origin = baseUrl.replace(/\/+$/, '');
  const doFetch = fetchImpl ?? ((...args: Parameters<typeof fetch>) => fetch(...args));

  async function send<TResponse>(path: string, init: RequestInit): Promise<TResponse> {
    let response: Response;
    try {
      response = await doFetch(`${origin}${path}`, { ...init, credentials: 'include' });
    } catch {
      throw new NetworkError();
    }

    const payload = await readJson(response);
    if (!response.ok) {
      throw new ApiError(response.status, payload as ErrorResponse | undefined);
    }
    if (payload === undefined) {
      throw new ApiError(response.status);
    }
    return payload as TResponse;
  }

  return {
    get<TResponse>(path: string, options: RequestOptions = {}): Promise<TResponse> {
      return send<TResponse>(path, { method: 'GET', headers: headersFor(options, false) });
    },
    post<TResponse>(
      path: string,
      body?: unknown,
      options: RequestOptions = {},
    ): Promise<TResponse> {
      const hasBody = body !== undefined;
      return send<TResponse>(path, {
        method: 'POST',
        headers: headersFor(options, hasBody),
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
      });
    },
  };
}
