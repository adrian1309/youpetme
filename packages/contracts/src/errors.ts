/** One invalid field; `code` is stable and machine-readable, `message` is for display. */
export interface ErrorDetail {
  field: string;
  code: string;
  message: string;
}

/** Error body returned by every endpoint; never contains internal details. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ErrorDetail[];
}
