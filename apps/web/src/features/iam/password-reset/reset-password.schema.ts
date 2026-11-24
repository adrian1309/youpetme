import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  type PasswordResetConfirmRequest,
} from '@youpetme/contracts';
import { z } from 'zod';

/** Validation messages are translation keys; the UI renders them with t() (NFR — i18n). */
export const resetPasswordErrorKey = (path: string): string => `resetPassword.errors.${path}`;

/** Same password policy as registration (ADR-002): length only; never trimmed. */
const passwordField = z
  .string({ error: resetPasswordErrorKey('password.required') })
  .superRefine((value, ctx) => {
    if (value.length === 0) {
      ctx.addIssue({ code: 'custom', message: resetPasswordErrorKey('password.required') });
    } else if (value.length < PASSWORD_MIN_LENGTH) {
      ctx.addIssue({ code: 'custom', message: resetPasswordErrorKey('password.tooShort') });
    } else if (value.length > PASSWORD_MAX_LENGTH) {
      ctx.addIssue({ code: 'custom', message: resetPasswordErrorKey('password.tooLong') });
    }
  });

export const resetPasswordSchema = z
  .object({
    password: passwordField,
    confirmPassword: z.string({ error: resetPasswordErrorKey('confirmPassword.required') }),
  })
  .check((context) => {
    const { password, confirmPassword } = context.value;
    if (confirmPassword.length === 0) {
      context.issues.push({
        code: 'custom',
        input: confirmPassword,
        path: ['confirmPassword'],
        message: resetPasswordErrorKey('confirmPassword.required'),
      });
    } else if (confirmPassword !== password) {
      context.issues.push({
        code: 'custom',
        input: confirmPassword,
        path: ['confirmPassword'],
        message: resetPasswordErrorKey('confirmPassword.mismatch'),
      });
    }
  });

export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;

export const RESET_PASSWORD_DEFAULTS: ResetPasswordFormValues = {
  password: '',
  confirmPassword: '',
};

/** The passwords are sent exactly as typed. */
export function toPasswordResetConfirmRequest(
  token: string,
  values: ResetPasswordFormValues,
): PasswordResetConfirmRequest {
  return { token, password: values.password, confirmPassword: values.confirmPassword };
}
