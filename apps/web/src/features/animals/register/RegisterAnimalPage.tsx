import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AGE_GROUPS, type AnimalDetail, SIZES, SPECIES, TEMPERAMENTS } from '@youpetme/contracts';
import { useId, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { CheckboxField } from '../../../components/CheckboxField';
import { describedBy, useFieldIds } from '../../../components/field-ids';
import { FieldMessages } from '../../../components/FieldMessages';
import { PageTitle } from '../../../components/PageTitle';
import { SelectField } from '../../../components/SelectField';
import { TextField } from '../../../components/TextField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';
import { ANIMALS_PATH } from '../animal-tags';
import {
  FIELD_LIMITS,
  REGISTER_ANIMAL_DEFAULTS,
  registerAnimalSchema,
  toCreateAnimalRequest,
  type RegisterAnimalFormValues,
} from './register-animal.schema';

type FieldName = keyof RegisterAnimalFormValues;

const err = (key: string) => `animals.register.errors.${key}`;

/** Maps one API validation detail (ADR-017) to a form field and a translation key. */
function fromApiDetail(field: string, code: string): { name: FieldName; key: string } | null {
  const name = (field === 'photoUrls' ? 'photoUrl' : field) as FieldName;
  if (!(name in REGISTER_ANIMAL_DEFAULTS)) return null;
  const isChoice = name === 'species' || name === 'size' || name === 'ageGroup';
  if (code === 'REQUIRED') return { name, key: err(isChoice ? 'choose' : 'required') };
  if (code === 'TOO_LONG') return { name, key: err('tooLong') };
  if (code === 'INVALID_FORMAT' && name === 'photoUrl') return { name, key: err('photoUrl') };
  return { name, key: err('invalid') };
}

/** `/admin/animals/new`: the ADMIN registers an animal (SCRUM-10). Wrapped in RequireAdmin. */
export function RegisterAnimalPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { authorized } = useAuth();
  const navigate = useNavigate();
  const titleId = useId();
  const [formError, setFormError] = useState<string | null>(null);
  const submitting = useRef(false);

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<RegisterAnimalFormValues>({
    resolver: zodResolver(registerAnimalSchema),
    defaultValues: REGISTER_ANIMAL_DEFAULTS,
    mode: 'onSubmit',
  });

  const mutation = useMutation({
    gcTime: 0,
    mutationFn: (values: RegisterAnimalFormValues) =>
      authorized((accessToken) =>
        client.post<AnimalDetail>(ANIMALS_PATH, toCreateAnimalRequest(values), { accessToken }),
      ),
  });

  async function onValid(values: RegisterAnimalFormValues) {
    if (submitting.current) return;
    submitting.current = true;
    setFormError(null);
    try {
      const created = await mutation.mutateAsync(values);
      void navigate(`/animals/${created.id}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400 && error.body?.details?.length) {
        const mapped = error.body.details
          .map((detail) => fromApiDetail(detail.field, detail.code))
          .filter((item) => item !== null);
        for (const { name, key } of mapped) setError(name, { type: 'server', message: key });
        if (mapped[0]) setFocus(mapped[0].name);
        if (mapped.length === 0) setFormError(err('generic'));
      } else if (error instanceof ApiError && error.status === 403) {
        setFormError(err('forbidden'));
      } else {
        setFormError(err('generic'));
      }
    } finally {
      submitting.current = false;
    }
  }

  const message = (name: FieldName) => {
    const key = errors[name]?.message;
    return key ? t(key, { max: FIELD_LIMITS[name as keyof typeof FIELD_LIMITS] }) : undefined;
  };
  const choose = (key: string, values: readonly string[]) => [
    { value: '', label: t('animals.register.fields.choose') },
    ...values.map((value) => ({ value, label: t(`animals.${key}.${value}`) })),
  ];
  const compatibility = [
    { value: 'unknown', label: t('animals.register.fields.compatibility.unknown') },
    { value: 'yes', label: t('animals.register.fields.compatibility.yes') },
    { value: 'no', label: t('animals.register.fields.compatibility.no') },
  ];
  const label = (name: string) => t(`animals.register.fields.${name}.label`);
  const title = t('animals.register.title');
  const pending = mutation.isPending;

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      <PageTitle title={title} />
      <h1 id={titleId} className="mb-6 text-3xl font-bold text-text">
        {title}
      </h1>
      <form
        aria-labelledby={titleId}
        noValidate
        onSubmit={(event) => void handleSubmit(onValid)(event)}
        className="space-y-5"
      >
        {formError ? <Alert focusOnMount>{t(formError)}</Alert> : null}

        <TextField {...register('name')} label={label('name')} required error={message('name')} />
        <SelectField
          {...register('species')}
          label={label('species')}
          options={choose('species', SPECIES)}
          required
          error={message('species')}
        />
        <SelectField
          {...register('size')}
          label={label('size')}
          options={choose('size', SIZES)}
          required
          error={message('size')}
        />
        <SelectField
          {...register('ageGroup')}
          label={label('ageGroup')}
          options={choose('ageGroup', AGE_GROUPS)}
          required
          error={message('ageGroup')}
        />
        <TextField
          {...register('photoUrl')}
          type="url"
          label={label('photoUrl')}
          hint={t('animals.register.fields.photoUrl.hint')}
          required
          error={message('photoUrl')}
        />
        <TextField {...register('breed')} label={label('breed')} error={message('breed')} />

        <fieldset className="space-y-3">
          <legend className="mb-1 text-base font-medium text-text">
            {t('animals.register.fields.temperament.legend')}
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {TEMPERAMENTS.map((tag) => (
              <CheckboxField
                key={tag}
                {...register('temperament')}
                value={tag}
                label={t(`animals.temperament.${tag}`)}
              />
            ))}
          </div>
        </fieldset>

        <SelectField
          {...register('compatibleWithChildren')}
          label={label('compatibleWithChildren')}
          options={compatibility}
        />
        <SelectField
          {...register('compatibleWithOtherAnimals')}
          label={label('compatibleWithOtherAnimals')}
          options={compatibility}
        />
        <TextArea
          {...register('careNotes')}
          label={label('careNotes')}
          error={message('careNotes')}
        />

        <Button type="submit" pending={pending}>
          {pending
            ? t('animals.register.actions.submitting')
            : t('animals.register.actions.submit')}
        </Button>
        <p role="status" className="sr-only">
          {pending ? t('animals.register.actions.submitting') : ''}
        </p>
      </form>
    </div>
  );
}

function TextArea({
  label,
  error,
  ...props
}: Omit<React.ComponentProps<'textarea'>, 'id'> & { label: string; error?: string }) {
  const ids = useFieldIds();
  return (
    <div>
      <label htmlFor={ids.inputId} className="mb-1 block text-base font-medium text-text">
        {label}
      </label>
      <textarea
        {...props}
        id={ids.inputId}
        rows={4}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { error })}
        className={`block w-full rounded-control border bg-surface px-3 py-2 text-base text-text ${
          error ? 'border-2 border-feedback-error' : 'border-border-input'
        }`}
      />
      <FieldMessages ids={ids} error={error} />
    </div>
  );
}
