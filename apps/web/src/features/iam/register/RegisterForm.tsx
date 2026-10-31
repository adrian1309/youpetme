import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import type { RegisterResponse } from '@youpetme/contracts';
import { useRef, useState } from 'react';
import { useForm, useWatch, type SubmitErrorHandler } from 'react-hook-form';
import { Trans, useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { CheckboxField } from '../../../components/CheckboxField';
import { PasswordField } from '../../../components/PasswordField';
import { TextField } from '../../../components/TextField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { readDiangoWelcomeSeen } from '../../../lib/storage/diango-welcome';
import { useAuth } from '../auth/auth-state';
import { mapRegisterError, type RegisterField } from './map-register-error';
import { NewTabLink } from './NewTabLink';
import { REGISTER_LIMITS } from './register-limits';
import {
  REGISTER_FORM_DEFAULTS,
  registerSchema,
  toRegisterRequest,
  type RegisterFormValues,
} from './register.schema';

const REGISTER_PATH = '/api/v1/auth/register';

/** Fields in the order they appear on the page, which is the order focus moves through errors. */
const FIELD_ORDER: RegisterField[] = [
  'firstName',
  'lastName',
  'email',
  'password',
  'confirmPassword',
  'termsAccepted',
];

export function RegisterForm({ titleId }: { titleId: string }) {
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
    control,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: REGISTER_FORM_DEFAULTS,
    mode: 'onBlur',
    reValidateMode: 'onBlur',
    shouldFocusError: false,
  });

  const mutation = useMutation({
    // Do not keep the submitted password or the access token in the query cache after unmounting.
    gcTime: 0,
    mutationFn: (values: RegisterFormValues) =>
      client.post<RegisterResponse>(
        REGISTER_PATH,
        toRegisterRequest(values, { hasSeenWelcome: readDiangoWelcomeSeen() }),
      ),
  });

  function focusField(name: RegisterField) {
    focusedByForm.current = true;
    setFocus(name);
    // React may deliver the focus event after this call returns, so lift the guard later.
    setTimeout(() => {
      focusedByForm.current = false;
    }, 0);
  }

  function bind(name: RegisterField) {
    return {
      ...register(name),
      // Design System: an error is cleared as soon as the user comes back to the field.
      onFocus: () => {
        if (!focusedByForm.current) clearErrors(name);
      },
    };
  }

  function messageFor(name: RegisterField): string | undefined {
    const key = errors[name]?.message;
    return key ? t(key, REGISTER_LIMITS) : undefined;
  }

  const onInvalid: SubmitErrorHandler<RegisterFormValues> = (invalid) => {
    const first = FIELD_ORDER.find((name) => invalid[name]);
    if (first) focusField(first);
  };

  async function onValid(values: RegisterFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      const response = await mutation.mutateAsync(values);
      const { accessToken } = response.authentication;
      const { id, firstName, lastName, email } = response.user;
      signIn({ accessToken, user: { id, firstName, lastName, email } });
      void navigate('/', { replace: true });
    } catch (error) {
      const mapped = mapRegisterError(error);
      for (const [name, key] of Object.entries(mapped.fieldErrors)) {
        setError(name as RegisterField, { type: 'server', message: key });
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
  const passwordHint = `${t('register.fields.password.requirement', REGISTER_LIMITS)} — ${t(
    passwordLongEnough ? 'register.fields.password.met' : 'register.fields.password.pending',
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

      <div className="grid gap-5 sm:grid-cols-2">
        <TextField
          {...bind('firstName')}
          label={t('register.fields.firstName.label')}
          autoComplete="given-name"
          required
          error={messageFor('firstName')}
        />
        <TextField
          {...bind('lastName')}
          label={t('register.fields.lastName.label')}
          autoComplete="family-name"
          required
          error={messageFor('lastName')}
        />
      </div>

      <TextField
        {...bind('email')}
        type="email"
        label={t('register.fields.email.label')}
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        required
        error={messageFor('email')}
      />

      <PasswordField
        {...bind('password')}
        label={t('register.fields.password.label')}
        showLabel={t('register.fields.password.show')}
        hideLabel={t('register.fields.password.hide')}
        autoComplete="new-password"
        required
        hint={passwordHint}
        hintState={passwordLongEnough ? 'met' : 'pending'}
        error={messageFor('password')}
      />

      <PasswordField
        {...bind('confirmPassword')}
        label={t('register.fields.confirmPassword.label')}
        showLabel={t('register.fields.password.show')}
        hideLabel={t('register.fields.password.hide')}
        autoComplete="new-password"
        required
        error={messageFor('confirmPassword')}
      />

      <CheckboxField
        {...bind('termsAccepted')}
        required
        label={
          <Trans
            i18nKey="register.fields.terms.label"
            components={{
              terms: <NewTabLink to="/terms" />,
              privacy: <NewTabLink to="/privacy" />,
            }}
          />
        }
        error={messageFor('termsAccepted')}
      />

      <Button type="submit" pending={pending}>
        {pending ? t('register.actions.submitting') : t('register.actions.submit')}
      </Button>
      <p role="status" className="sr-only">
        {pending ? t('register.actions.submitting') : ''}
      </p>
    </form>
  );
}
