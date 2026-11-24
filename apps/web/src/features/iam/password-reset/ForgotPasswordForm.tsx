import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { PasswordResetRequestedResponse } from '@youpetme/contracts';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { TextField } from '../../../components/TextField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { REGISTER_LIMITS } from '../register/register-limits';
import {
  FORGOT_PASSWORD_DEFAULTS,
  forgotPasswordSchema,
  toPasswordResetRequest,
  type ForgotPasswordFormValues,
} from './forgot-password.schema';
import { mapForgotPasswordError } from './map-password-reset-error';

export const PASSWORD_RESET_REQUEST_PATH = '/api/v1/auth/password-reset/request';

interface ForgotPasswordFormProps {
  titleId: string;
  /** The API accepted the request; the page then shows the generic confirmation. */
  onSent(): void;
}

export function ForgotPasswordForm({ titleId, onSent }: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const client = useApiClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  // Focus moved by the form itself (to the error) must not clear that error.
  const focusedByForm = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: FORGOT_PASSWORD_DEFAULTS,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: false,
  });

  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (values: ForgotPasswordFormValues) =>
      client.post<PasswordResetRequestedResponse>(
        PASSWORD_RESET_REQUEST_PATH,
        toPasswordResetRequest(values),
      ),
  });

  function focusEmail() {
    focusedByForm.current = true;
    setFocus('email');
    // React may deliver the focus event after this call returns, so lift the guard later.
    setTimeout(() => {
      focusedByForm.current = false;
    }, 0);
  }

  async function onValid(values: ForgotPasswordFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
      onSent();
    } catch (error) {
      const mapped = mapForgotPasswordError(error);
      if (mapped.fieldErrors.email) {
        setError('email', { type: 'server', message: mapped.fieldErrors.email });
        focusEmail();
      }
      setFormError(mapped.formError ?? null);
    } finally {
      submitting.current = false;
    }
  }

  const pending = mutation.isPending;
  const emailError = errors.email?.message;

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      onSubmit={(event) => void handleSubmit(onValid, () => focusEmail())(event)}
      className="space-y-5"
    >
      {formError ? <Alert focusOnMount>{t(formError)}</Alert> : null}

      <TextField
        {...register('email')}
        // Design System: an error is cleared as soon as the user comes back to the field.
        onFocus={() => {
          if (!focusedByForm.current) clearErrors('email');
        }}
        type="email"
        label={t('forgotPassword.fields.email.label')}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={emailError ? t(emailError, REGISTER_LIMITS) : undefined}
      />

      <Button type="submit" pending={pending}>
        {pending ? t('forgotPassword.actions.submitting') : t('forgotPassword.actions.submit')}
      </Button>
      <p role="status" className="sr-only">
        {pending ? t('forgotPassword.actions.submitting') : ''}
      </p>
    </form>
  );
}
