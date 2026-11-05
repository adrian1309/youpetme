/** Codes the API uses to report an invalid field (`ErrorDetail.code`). */
export type ValidationErrorCode =
  | 'REQUIRED'
  | 'INVALID_FORMAT'
  | 'INVALID_TYPE'
  | 'TOO_SHORT'
  | 'TOO_LONG'
  | 'MISMATCH'
  | 'MUST_BE_TRUE';

/** One invalid field; `code` is stable and machine-readable, `message` is for display. */
export interface ErrorDetail {
  field: string;
  code: ValidationErrorCode | (string & {});
  message: string;
}

/**
 * Stable, machine-readable reason for an error, for the cases a client must tell apart from
 * others with the same status (for example a 403 for an unavailable account versus a 403 for a
 * rejected Origin). Absent when the status alone is enough.
 */
export type ErrorCode = 'INVALID_CREDENTIALS' | 'ACCOUNT_NOT_AVAILABLE' | 'SESSION_NOT_RENEWABLE';

/** Error body returned by every endpoint; never contains internal details. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  code?: ErrorCode;
  details?: ErrorDetail[];
}
