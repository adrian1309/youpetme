import { Lock } from 'lucide-react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { PasswordResetConfirmedResponse } from '@youpetme/contracts';
import { useRef, useState } from 'react';
import { useForm, useWatch, type SubmitErrorHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { PasswordField } from '../../../components/PasswordField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { REGISTER_LIMITS } from '../register/register-limits';
import { mapResetPasswordError } from './map-password-reset-error';
import {
  RESET_PASSWORD_DEFAULTS,
  resetPasswordSchema,
  toPasswordResetConfirmRequest,
  type ResetPasswordFormValues,
} from './reset-password.schema';

export const PASSWORD_RESET_CONFIRM_PATH = '/api/v1/auth/password-reset/confirm';

type ResetField = keyof ResetPasswordFormValues;

/** Fields in the order they appear on the page, which is the order focus moves through errors. */
const FIELD_ORDER: ResetField[] = ['password', 'confirmPassword'];

interface ResetPasswordFormProps {
  titleId: string;
  /** The token of the emailed link; never shown, logged or put back in the URL. */
  token: string;
  /** The password was changed: every session of the user is revoked. */
  onDone(): Promise<void> | void;
  /** The link can no longer be used. */
  onLinkInvalid(): void;
}

export function ResetPasswordForm({
  titleId,
  token,
  onDone,
  onLinkInvalid,
}: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const client = useApiClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  // Focus moved by the form itself (to the first error) must not clear that error.
  const focusedByForm = useRef(false);

  const {
    register,
    control,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: RESET_PASSWORD_DEFAULTS,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: false,
  });

  const mutation = useMutation({
    // Do not keep the submitted passwords or the token in the query cache.
    gcTime: 0,
    mutationFn: (values: ResetPasswordFormValues) =>
      client.post<PasswordResetConfirmedResponse>(
        PASSWORD_RESET_CONFIRM_PATH,
        toPasswordResetConfirmRequest(token, values),
      ),
  });

  function focusField(name: ResetField) {
    focusedByForm.current = true;
    setFocus(name);
    // React may deliver the focus event after this call returns, so lift the guard later.
    setTimeout(() => {
      focusedByForm.current = false;
    }, 0);
  }

  function bind(name: ResetField) {
    return {
      ...register(name),
      // Design System: an error is cleared as soon as the user comes back to the field.
      onFocus: () => {
        if (!focusedByForm.current) clearErrors(name);
      },
    };
  }

  function messageFor(name: ResetField): string | undefined {
    const key = errors[name]?.message;
    return key ? t(key, REGISTER_LIMITS) : undefined;
  }

  const onInvalid: SubmitErrorHandler<ResetPasswordFormValues> = (invalid) => {
    const first = FIELD_ORDER.find((name) => invalid[name]);
    if (first) focusField(first);
  };

  async function onValid(values: ResetPasswordFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      await mutation.mutateAsync(values);
      await onDone();
    } catch (error) {
      const mapped = mapResetPasswordError(error);
      if (mapped.invalidLink) {
        onLinkInvalid();
        return;
      }
      for (const [name, key] of Object.entries(mapped.fieldErrors)) {
        setError(name as ResetField, { type: 'server', message: key });
      }
      setFormError(mapped.formError ?? null);
      const first = FIELD_ORDER.find((name) => mapped.fieldErrors[name]);
      if (first) focusField(first);
    } finally {
      submitting.current = false;
    }
  }

  const password = useWatch({ control, name: 'password' });
  const passwordLongEnough =
    password.length >= REGISTER_LIMITS.min && password.length <= REGISTER_LIMITS.max;
  const passwordHint = `${t('resetPassword.fields.password.requirement', REGISTER_LIMITS)} — ${t(
    passwordLongEnough
      ? 'resetPassword.fields.password.met'
      : 'resetPassword.fields.password.pending',
  )}`;

  const pending = mutation.isPending;

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      onSubmit={(event) => void handleSubmit(onValid, onInvalid)(event)}
      className="space-y-5"
    >
      {formError ? <Alert focusOnMount>{t(formError)}</Alert> : null}

      <PasswordField
        {...bind('password')}
        label={t('resetPassword.fields.password.label')}
        startIcon={<Lock className="size-5" />}
        showLabel={t('resetPassword.fields.password.show')}
        hideLabel={t('resetPassword.fields.password.hide')}
        autoComplete="new-password"
        required
        hint={passwordHint}
        hintState={passwordLongEnough ? 'met' : 'pending'}
        error={messageFor('password')}
      />

      <PasswordField
        {...bind('confirmPassword')}
        label={t('resetPassword.fields.confirmPassword.label')}
        startIcon={<Lock className="size-5" />}
        showLabel={t('resetPassword.fields.confirmPassword.show')}
        hideLabel={t('resetPassword.fields.confirmPassword.hide')}
        autoComplete="new-password"
        required
        error={messageFor('confirmPassword')}
      />

      <Button type="submit" pending={pending}>
        {pending ? t('resetPassword.actions.submitting') : t('resetPassword.actions.submit')}
      </Button>
      <p role="status" className="sr-only">
        {pending ? t('resetPassword.actions.submitting') : ''}
      </p>
    </form>
  );
}
