import { EMAIL_MAX_LENGTH, type PasswordResetRequest } from '@youpetme/contracts';
import { z } from 'zod';

import { EMAIL_PATTERN } from '../register/register.schema';

/** Validation messages are translation keys; the UI renders them with t() (NFR — i18n). */
export const forgotPasswordErrorKey = (path: string): string => `forgotPassword.errors.${path}`;

const emailField = z
  .string({ error: forgotPasswordErrorKey('email.required') })
  .superRefine((value, ctx) => {
    const normalized = value.trim().toLowerCase();
    if (normalized.length === 0) {
      ctx.addIssue({ code: 'custom', message: forgotPasswordErrorKey('email.required') });
    } else if (normalized.length > EMAIL_MAX_LENGTH) {
      ctx.addIssue({ code: 'custom', message: forgotPasswordErrorKey('email.tooLong') });
    } else if (!EMAIL_PATTERN.test(normalized)) {
      ctx.addIssue({ code: 'custom', message: forgotPasswordErrorKey('email.invalid') });
    }
  });

export const forgotPasswordSchema = z.object({ email: emailField });

export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;

export const FORGOT_PASSWORD_DEFAULTS: ForgotPasswordFormValues = { email: '' };

/** The email is trimmed, as everywhere else. */
export function toPasswordResetRequest(values: ForgotPasswordFormValues): PasswordResetRequest {
  return { email: values.email.trim() };
}
