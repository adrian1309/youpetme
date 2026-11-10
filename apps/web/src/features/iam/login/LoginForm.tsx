import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { LoginResponse } from '@youpetme/contracts';
import { useRef, useState } from 'react';
import { useForm, type SubmitErrorHandler } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { PasswordField } from '../../../components/PasswordField';
import { TextField } from '../../../components/TextField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { useAuth } from '../auth/auth-state';
import { REGISTER_LIMITS } from '../register/register-limits';
import {
  LOGIN_FORM_DEFAULTS,
  loginSchema,
  toLoginRequest,
  type LoginFormValues,
} from './login.schema';
import { mapLoginError, type LoginField } from './map-login-error';

const LOGIN_PATH = '/api/v1/auth/login';

/** Fields in the order they appear on the page, which is the order focus moves through errors. */
const FIELD_ORDER: LoginField[] = ['email', 'password'];

export function LoginForm({ titleId }: { titleId: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const client = useApiClient();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);
  // Focus moved by the form itself (to the first error) must not clear that error.
  const focusedByForm = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    clearErrors,
    setFocus,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: LOGIN_FORM_DEFAULTS,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: false,
  });

  const mutation = useMutation({
    // Do not keep the submitted password or the access token in the query cache.
    gcTime: 0,
    mutationFn: (values: LoginFormValues) =>
      client.post<LoginResponse>(LOGIN_PATH, toLoginRequest(values)),
  });

  function focusField(name: LoginField) {
    focusedByForm.current = true;
    setFocus(name);
    // React may deliver the focus event after this call returns, so lift the guard later.
    setTimeout(() => {
      focusedByForm.current = false;
    }, 0);
  }

  function bind(name: LoginField) {
    return {
      ...register(name),
      // Design System: an error is cleared as soon as the user comes back to the field.
      onFocus: () => {
        if (!focusedByForm.current) clearErrors(name);
      },
    };
  }

  function messageFor(name: LoginField): string | undefined {
    const key = errors[name]?.message;
    return key ? t(key, REGISTER_LIMITS) : undefined;
  }

  const onInvalid: SubmitErrorHandler<LoginFormValues> = (invalid) => {
    const first = FIELD_ORDER.find((name) => invalid[name]);
    if (first) focusField(first);
  };

  async function onValid(values: LoginFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      const response = await mutation.mutateAsync(values);
      const { id, firstName, lastName, email } = response.user;
      // The access token stays in memory; the refresh token is an HttpOnly cookie (ADR-002).
      signIn({
        accessToken: response.authentication.accessToken,
        user: { id, firstName, lastName, email },
      });
      void navigate('/', { replace: true });
    } catch (error) {
      const mapped = mapLoginError(error);
      for (const [name, key] of Object.entries(mapped.fieldErrors)) {
        setError(name as LoginField, { type: 'server', message: key });
      }
      setFormError(mapped.formError ?? null);
      const first = FIELD_ORDER.find((name) => mapped.fieldErrors[name]);
      if (first) focusField(first);
    } finally {
      submitting.current = false;
    }
  }

  const pending = mutation.isPending;

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      onSubmit={(event) => void handleSubmit(onValid, onInvalid)(event)}
      className="space-y-5"
    >
      {formError ? <Alert focusOnMount>{t(formError)}</Alert> : null}

      <TextField
        {...bind('email')}
        type="email"
        label={t('login.fields.email.label')}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={messageFor('email')}
      />

      <PasswordField
        {...bind('password')}
        label={t('login.fields.password.label')}
        showLabel={t('login.fields.password.show')}
        hideLabel={t('login.fields.password.hide')}
        autoComplete="current-password"
        required
        error={messageFor('password')}
      />

      <Button type="submit" pending={pending}>
        {pending ? t('login.actions.submitting') : t('login.actions.submit')}
      </Button>
      <p role="status" className="sr-only">
        {pending ? t('login.actions.submitting') : ''}
      </p>
    </form>
  );
}
