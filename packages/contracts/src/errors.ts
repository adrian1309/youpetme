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

/** Error body returned by every endpoint; never contains internal details. */
export interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string;
  details?: ErrorDetail[];
}
