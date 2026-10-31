import type { ErrorResponse } from '@youpetme/contracts';

/** The API answered with an error status. Messages never include request or response data. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    /** The structured error body, when the response had one. */
    readonly body?: ErrorResponse,
  ) {
    super(`Request failed with status ${status}`);
    this.name = 'ApiError';
  }
}

/** The request could not be made or completed (offline, DNS, CORS, connection reset…). */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}
