import { ApiError, NetworkError } from '../../../lib/http/api-error';
import { forgotPasswordErrorKey, type ForgotPasswordFormValues } from './forgot-password.schema';
import { resetPasswordErrorKey, type ResetPasswordFormValues } from './reset-password.schema';

export interface FormErrorResult<Field extends string> {
  /** Translation keys by form field. */
  fieldErrors: Partial<Record<Field, string>>;
  /** Translation key for a message that applies to the whole form. */
  formError?: string;
}

/** For each field, the API validation codes (ADR-017) it shows, as translation key suffixes. */
type FieldErrorPaths<Field extends string> = Record<Field, Record<string, string>>;

const FORGOT_PASSWORD_FIELDS: FieldErrorPaths<keyof ForgotPasswordFormValues> = {
  email: { REQUIRED: 'email.required', INVALID_FORMAT: 'email.invalid', TOO_LONG: 'email.tooLong' },
};

const RESET_PASSWORD_FIELDS: FieldErrorPaths<keyof ResetPasswordFormValues> = {
  password: {
    REQUIRED: 'password.required',
    TOO_SHORT: 'password.tooShort',
    TOO_LONG: 'password.tooLong',
  },
  confirmPassword: { REQUIRED: 'confirmPassword.required', MISMATCH: 'confirmPassword.mismatch' },
};

/**
 * Validation details go on their fields; everything else is one form-level message. The API's
 * own `message` is never shown.
 */
function mapFormError<Field extends string>(
  error: unknown,
  errorKey: (path: string) => string,
  fieldPaths: FieldErrorPaths<Field>,
): FormErrorResult<Field> {
  const formError = (path: string): FormErrorResult<Field> => ({
    fieldErrors: {},
    formError: errorKey(path),
  });

  if (error instanceof NetworkError) return formError('network');
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 415) return formError('requestRejected');
    if (error.status === 400) {
      const fieldErrors: Partial<Record<Field, string>> = {};
      const paths = fieldPaths as Record<string, Record<string, string> | undefined>;
      for (const detail of error.body?.details ?? []) {
        const path = paths[detail.field]?.[detail.code];
        const field = detail.field as Field;
        if (path && !(field in fieldErrors)) fieldErrors[field] = errorKey(path);
      }
      return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : formError('reviewFields');
    }
    if (error.status >= 500) return formError('server');
  }
  return formError('generic');
}

/** Errors of /forgot-password. */
export function mapForgotPasswordError(
  error: unknown,
): FormErrorResult<keyof ForgotPasswordFormValues> {
  return mapFormError(error, forgotPasswordErrorKey, FORGOT_PASSWORD_FIELDS);
}

export type ResetPasswordErrorResult =
  { invalidLink: true } | ({ invalidLink: false } & FormErrorResult<keyof ResetPasswordFormValues>);

/**
 * Errors of /reset-password. A link that can no longer be used (RESET_TOKEN_INVALID, or a token
 * the API did not receive) gets its own screen, whatever the reason (TS-IAM-004).
 */
export function mapResetPasswordError(error: unknown): ResetPasswordErrorResult {
  if (error instanceof ApiError && error.status === 400) {
    const tokenRejected =
      error.body?.code === 'RESET_TOKEN_INVALID' ||
      (error.body?.details ?? []).some((detail) => detail.field === 'token');
    if (tokenRejected) return { invalidLink: true };
  }
  return {
    invalidLink: false,
    ...mapFormError(error, resetPasswordErrorKey, RESET_PASSWORD_FIELDS),
  };
}
