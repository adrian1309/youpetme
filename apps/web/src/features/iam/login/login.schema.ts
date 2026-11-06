import { EMAIL_MAX_LENGTH, type LoginRequest } from '@youpetme/contracts';
import { z } from 'zod';

import { EMAIL_PATTERN } from '../register/register.schema';

/** Validation messages are translation keys; the UI renders them with t() (NFR — i18n). */
const errorKey = (path: string): string => `login.errors.${path}`;

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

/** TS-IAM-002: presence only. The password policy applies at registration, not at login. */
const passwordField = z
  .string({ error: errorKey('password.required') })
  .min(1, { error: errorKey('password.required') });

export const loginSchema = z.object({ email: emailField, password: passwordField });

export type LoginFormValues = z.infer<typeof loginSchema>;

export const LOGIN_FORM_DEFAULTS: LoginFormValues = { email: '', password: '' };

/** The email is trimmed; the password is sent exactly as typed. */
export function toLoginRequest(values: LoginFormValues): LoginRequest {
  return { email: values.email.trim(), password: values.password };
}
