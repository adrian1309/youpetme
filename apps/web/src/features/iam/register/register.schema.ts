import {
  EMAIL_MAX_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type RegisterRequest,
} from '@youpetme/contracts';
import { z } from 'zod';

/**
 * Same pattern as the API's Email value object. The server stays the source of truth: this only
 * gives the user feedback before sending.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/;

/** Validation messages are translation keys; the UI renders them with t() (NFR — i18n). */
const errorKey = (path: string): string => `register.errors.${path}`;

function nameField(field: 'firstName' | 'lastName') {
  return z.string({ error: errorKey(`${field}.required`) }).superRefine((value, ctx) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      ctx.addIssue({ code: 'custom', message: errorKey(`${field}.required`) });
    } else if ([...trimmed].length > NAME_MAX_LENGTH) {
      // Characters, not UTF-16 units, as the API counts them.
      ctx.addIssue({ code: 'custom', message: errorKey(`${field}.tooLong`) });
    }
  });
}

const emailField = z.string({ error: errorKey('email.required') }).superRefine((value, ctx) => {
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) {
    ctx.addIssue({ code: 'custom', message: errorKey('email.required') });
  } else if (normalized.length > EMAIL_MAX_LENGTH) {
    ctx.addIssue({ code: 'custom', message: errorKey('email.tooLong') });
  } else if (!EMAIL_PATTERN.test(normalized)) {
    ctx.addIssue({ code: 'custom', message: errorKey('email.invalid') });
  }
});

/** ADR-002: length only, no complexity rules; the password is never trimmed. */
const passwordField = z
  .string({ error: errorKey('password.required') })
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({ code: 'custom', message: errorKey('password.required') });
    } else if (value.length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({ code: 'custom', message: errorKey('password.tooShort') });
    } else if (value.length > PASSWORD_MAX_LENGTH) {
      ctx.addIssue({ code: 'custom', message: errorKey('password.tooLong') });
    }
  });

export const registerSchema = z
  .object({
    firstName: nameField('firstName'),
    lastName: nameField('lastName'),
    email: emailField,
    password: passwordField,
    confirmPassword: z.string({ error: errorKey('confirmPassword.required') }),
    termsAccepted: z.boolean({ error: errorKey('terms.required') }),
  })
  .check((context) => {
    const { password, confirmPassword, termsAccepted } = context.value;
    if (confirmPassword.length === 0) {
      context.issues.push({
        code: 'custom',
        input: confirmPassword,
        path: ['confirmPassword'],
        message: errorKey('confirmPassword.required'),
      });
    } else if (confirmPassword !== password) {
      context.issues.push({
        code: 'custom',
        input: confirmPassword,
        path: ['confirmPassword'],
        message: errorKey('confirmPassword.mismatch'),
      });
    }
    if (!termsAccepted) {
      context.issues.push({
        code: 'custom',
        input: termsAccepted,
        path: ['termsAccepted'],
        message: errorKey('terms.required'),
      });
    }
  });

export type RegisterFormValues = z.infer<typeof registerSchema>;

export const REGISTER_FORM_DEFAULTS: RegisterFormValues = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  confirmPassword: '',
  termsAccepted: false,
};

/** Builds the API body: names and email trimmed, hasSeenWelcome sent only when true. */
export function toRegisterRequest(
  values: RegisterFormValues,
  options: { hasSeenWelcome?: boolean } = {},
): RegisterRequest {
  return {
    firstName: values.firstName.trim(),
    lastName: values.lastName.trim(),
    email: values.email.trim(),
    password: values.password,
    confirmPassword: values.confirmPassword,
    termsAccepted: values.termsAccepted,
    ...(options.hasSeenWelcome === true ? { hasSeenWelcome: true } : {}),
  };
}
