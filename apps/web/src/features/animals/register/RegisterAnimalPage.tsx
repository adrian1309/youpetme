import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { AGE_GROUPS, type AnimalDetail, SIZES, SPECIES, TEMPERAMENTS } from '@youpetme/contracts';
import { Cake, CirclePlus, LoaderCircle, PawPrint, Ruler } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { AnimalPhoto } from '../../../components/AnimalPhoto';
import { Button } from '../../../components/Button';
import { describedBy, useFieldIds } from '../../../components/field-ids';
import { FieldMessages } from '../../../components/FieldMessages';
import { PageTitle } from '../../../components/PageTitle';
import { PillFieldset, PillOption } from '../../../components/PillChoice';
import { TextField } from '../../../components/TextField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';
import { ANIMALS_PATH } from '../animal-tags';
import {
  FIELD_LIMITS,
  isHttpsUrl,
  REGISTER_ANIMAL_DEFAULTS,
  registerAnimalSchema,
  toCreateAnimalRequest,
  type RegisterAnimalFormValues,
} from './register-animal.schema';

type FieldName = keyof RegisterAnimalFormValues;

const err = (key: string) => `animals.register.errors.${key}`;

const choiceValues = { species: SPECIES, size: SIZES, ageGroup: AGE_GROUPS } as const;
const choiceIcons = {
  species: <PawPrint aria-hidden="true" className="size-5 text-brand-primary" />,
  size: <Ruler aria-hidden="true" className="size-5 text-brand-primary" />,
  ageGroup: <Cake aria-hidden="true" className="size-5 text-brand-primary" />,
};

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

/**
 * `/admin/animals/new`: the ADMIN registers an animal (SCRUM-10), in three blocks with pill
 * choices and a photo preview (SCRUM-56). Wrapped in RequireAdmin.
 */
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
    control,
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
  const compatibility = [
    { value: 'yes', label: t('animals.register.fields.compatibility.yes') },
    { value: 'no', label: t('animals.register.fields.compatibility.no') },
    { value: 'unknown', label: t('animals.register.fields.compatibility.unknown') },
  ];
  const photoUrl = useWatch({ control, name: 'photoUrl' });
  const animalName = useWatch({ control, name: 'name' }).trim();
  const label = (name: string) => t(`animals.register.fields.${name}.label`);
  const title = t('animals.register.title');
  const pending = mutation.isPending;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12 sm:py-16">
      <PageTitle title={title} />
      <div className="rounded-card border border-border-subtle bg-surface p-6 shadow-soft sm:p-8">
        <div className="mb-8 flex items-center gap-4">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
            <CirclePlus aria-hidden="true" className="size-7" />
          </span>
          <div>
            <h1 id={titleId} className="text-3xl font-bold text-text">
              {title}
            </h1>
            <p className="mt-1 text-base text-text-muted">{t('animals.register.intro')}</p>
          </div>
        </div>
        <form
          aria-labelledby={titleId}
          noValidate
          onSubmit={(event) => void handleSubmit(onValid)(event)}
          className="space-y-8"
        >
          {formError ? <Alert focusOnMount>{t(formError)}</Alert> : null}

          <FormSection title={t('animals.register.sections.basics')}>
            <TextField
              {...register('name')}
              label={label('name')}
              required
              error={message('name')}
            />
            {(['species', 'size', 'ageGroup'] as const).map((name) => (
              <PillFieldset
                key={name}
                legend={label(name)}
                icon={choiceIcons[name]}
                error={message(name)}
              >
                {choiceValues[name].map((value) => (
                  <PillOption
                    key={value}
                    type="radio"
                    {...register(name)}
                    value={value}
                    label={t(`animals.${name}.${value}`)}
                    aria-invalid={errors[name] ? true : undefined}
                  />
                ))}
              </PillFieldset>
            ))}
          </FormSection>

          <FormSection title={t('animals.register.sections.photo')}>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField
                {...register('photoUrl')}
                type="url"
                label={label('photoUrl')}
                hint={t('animals.register.fields.photoUrl.hint')}
                required
                error={message('photoUrl')}
              />
              <TextField {...register('breed')} label={label('breed')} error={message('breed')} />
            </div>
            {isHttpsUrl(photoUrl) ? (
              <AnimalPhoto
                src={photoUrl}
                alt={t('animals.register.fields.photoUrl.preview')}
                name={animalName || t('animals.register.fields.photoUrl.previewName')}
                className="aspect-[4/3] w-full max-w-sm rounded-card"
              />
            ) : null}
          </FormSection>

          <FormSection title={t('animals.register.sections.character')}>
            <PillFieldset legend={t('animals.register.fields.temperament.legend')}>
              {TEMPERAMENTS.map((tag) => (
                <PillOption
                  key={tag}
                  type="checkbox"
                  {...register('temperament')}
                  value={tag}
                  label={t(`animals.temperament.${tag}`)}
                />
              ))}
            </PillFieldset>
            {(['compatibleWithChildren', 'compatibleWithOtherAnimals'] as const).map((name) => (
              <PillFieldset key={name} legend={label(name)}>
                {compatibility.map((option) => (
                  <PillOption
                    key={option.value}
                    type="radio"
                    {...register(name)}
                    value={option.value}
                    label={option.label}
                  />
                ))}
              </PillFieldset>
            ))}
            <TextArea
              {...register('careNotes')}
              label={label('careNotes')}
              error={message('careNotes')}
            />
          </FormSection>

          <Button type="submit" pending={pending} size="lg">
            {pending ? (
              <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
            ) : (
              <CirclePlus aria-hidden="true" className="size-5" />
            )}
            {pending
              ? t('animals.register.actions.submitting')
              : t('animals.register.actions.submit')}
          </Button>
          <p role="status" className="sr-only">
            {pending ? t('animals.register.actions.submitting') : ''}
          </p>
        </form>
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5 border-t border-border-subtle pt-6 first-of-type:border-t-0 first-of-type:pt-0">
      <h2 className="text-xl font-bold text-text">{title}</h2>
      {children}
    </section>
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
        className={`block w-full rounded-control border bg-surface px-3 py-2 text-base text-text focus:border-brand-primary ${
          error ? 'border-2 border-feedback-error' : 'border-border-input'
        }`}
      />
      <FieldMessages ids={ids} error={error} />
    </div>
  );
}
