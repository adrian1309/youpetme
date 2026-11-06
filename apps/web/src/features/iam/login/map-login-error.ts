import { ApiError, NetworkError } from '../../../lib/http/api-error';
import type { LoginFormValues } from './login.schema';

export type LoginField = keyof LoginFormValues;

export interface LoginErrorResult {
  /** Translation keys by form field. */
  fieldErrors: Partial<Record<LoginField, string>>;
  /** Translation key for a message that applies to the whole form. */
  formError?: string;
}

const err = (path: string): string => `login.errors.${path}`;

/** (API field, API code) to the same translation keys the client schema uses. */
const FIELD_ERROR_KEYS: Record<string, Record<string, string>> = {
  email: {
    REQUIRED: err('email.required'),
    INVALID_FORMAT: err('email.invalid'),
    TOO_LONG: err('email.tooLong'),
  },
  password: { REQUIRED: err('password.required') },
};

function formError(key: string): LoginErrorResult {
  return { fieldErrors: {}, formError: key };
}

function mapValidationDetails(error: ApiError): LoginErrorResult {
  const fieldErrors: LoginErrorResult['fieldErrors'] = {};
  for (const detail of error.body?.details ?? []) {
    const key = FIELD_ERROR_KEYS[detail.field]?.[detail.code];
    const field = detail.field as LoginField;
    if (key && !(field in fieldErrors)) fieldErrors[field] = key;
  }
  return Object.keys(fieldErrors).length > 0 ? { fieldErrors } : formError(err('reviewFields'));
}

/**
 * Turns whatever the login request threw into translated feedback. Wrong credentials are a
 * form-level message on purpose: pointing at a field would reveal which one failed (TS-IAM-002).
 */
export function mapLoginError(error: unknown): LoginErrorResult {
  if (error instanceof NetworkError) return formError(err('network'));
  if (error instanceof ApiError) {
    if (error.status === 401) return formError(err('invalidCredentials'));
    if (error.status === 403 && error.body?.code === 'ACCOUNT_NOT_AVAILABLE') {
      return formError(err('accountNotAvailable'));
    }
    if (error.status === 403 || error.status === 415) return formError(err('requestRejected'));
    if (error.status === 400) return mapValidationDetails(error);
    if (error.status >= 500) return formError(err('server'));
  }
  return formError(err('generic'));
}
