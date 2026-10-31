import { ApiError, NetworkError } from '../../../lib/http/api-error';
import type { RegisterFormValues } from './register.schema';

export type RegisterField = keyof RegisterFormValues;

export interface RegisterErrorResult {
  /** Translation keys by form field. */
  fieldErrors: Partial<Record<RegisterField, string>>;
  /** Translation key for a message that applies to the whole form. */
  formError?: string;
}

const err = (path: string): string => `register.errors.${path}`;

/**
 * (API field, API code) to translation key. These are the same keys the client schema uses, so a
 * server-side rejection reads exactly like a client-side one. The server's own messages are
 * English and internal: they are never shown.
 */
export const FIELD_ERROR_KEYS: Record<string, Record<string, string>> = {
  firstName: { REQUIRED: err('firstName.required'), TOO_LONG: err('firstName.tooLong') },
  lastName: { REQUIRED: err('lastName.required'), TOO_LONG: err('lastName.tooLong') },
  email: {
    REQUIRED: err('email.required'),
    INVALID_FORMAT: err('email.invalid'),
    TOO_LONG: err('email.tooLong'),
  },
  password: {
    REQUIRED: err('password.required'),
    TOO_SHORT: err('password.tooShort'),
    TOO_LONG: err('password.tooLong'),
  },
  confirmPassword: {
    REQUIRED: err('confirmPassword.required'),
    MISMATCH: err('confirmPassword.mismatch'),
  },
  termsAccepted: { REQUIRED: err('terms.required'), MUST_BE_TRUE: err('terms.required') },
};

export const REGISTER_FORM_ERROR_KEYS = {
  emailInUse: err('emailInUse'),
  requestRejected: err('requestRejected'),
  server: err('server'),
  network: err('network'),
  reviewFields: err('reviewFields'),
  generic: err('generic'),
} as const;

function formError(key: string): RegisterErrorResult {
  return { fieldErrors: {}, formError: key };
}

function mapValidationDetails(error: ApiError): RegisterErrorResult {
  const fieldErrors: RegisterErrorResult['fieldErrors'] = {};
  for (const detail of error.body?.details ?? []) {
    const key = FIELD_ERROR_KEYS[detail.field]?.[detail.code];
    const field = detail.field as RegisterField;
    if (key && !(field in fieldErrors)) {
      fieldErrors[field] = key;
    }
  }
  return Object.keys(fieldErrors).length > 0
    ? { fieldErrors }
    : formError(REGISTER_FORM_ERROR_KEYS.reviewFields);
}

/** Turns whatever the registration request threw into translated, field-level feedback. */
export function mapRegisterError(error: unknown): RegisterErrorResult {
  if (error instanceof NetworkError) {
    return formError(REGISTER_FORM_ERROR_KEYS.network);
  }
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return { fieldErrors: { email: REGISTER_FORM_ERROR_KEYS.emailInUse } };
    }
    if (error.status === 400) {
      return mapValidationDetails(error);
    }
    if (error.status === 403 || error.status === 415) {
      return formError(REGISTER_FORM_ERROR_KEYS.requestRejected);
    }
    if (error.status >= 500) {
      return formError(REGISTER_FORM_ERROR_KEYS.server);
    }
  }
  return formError(REGISTER_FORM_ERROR_KEYS.generic);
}
