import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ADOPTION_MESSAGE_MAX_LENGTH,
  type AdoptionRequestItem,
  type AnimalDetail,
  type CreateAdoptionRequest,
} from '@youpetme/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Button } from '../../../components/Button';
import { Notice } from '../../../components/Notice';
import { TextAreaField } from '../../../components/TextAreaField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';

export const ADOPTION_REQUESTS_PATH = '/api/v1/adoption-requests';

type Step = 'closed' | 'open' | 'sent' | 'active';

const secondaryButton =
  'min-h-11 rounded-control border-2 border-brand-primary px-4 py-2 text-base font-semibold text-brand-primary hover:bg-surface';

/**
 * On the animal page: the "Solicitar adopción" action of an AVAILABLE animal (SCRUM-14) and, for
 * an ADMIN, the link to that animal's requests (SCRUM-15). A visitor is sent to /login and comes
 * back here after signing in. The API checks everything again (status, duplicates, role).
 */
export function AdoptionRequestSection({
  animal,
}: {
  animal: Pick<AnimalDetail, 'id' | 'name' | 'status'>;
}) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('closed');
  const openRef = useRef<HTMLButtonElement>(null);

  const adminLink =
    session?.user.role === 'ADMIN' ? (
      <p>
        <Link
          to={`/admin/adoption-requests?animalId=${encodeURIComponent(animal.id)}`}
          className="font-bold text-brand-primary"
        >
          {t('adoptions.request.adminLink', { name: animal.name })}
        </Link>
      </p>
    ) : null;

  if (animal.status !== 'AVAILABLE') return adminLink;

  function open() {
    if (!session) {
      void navigate('/login', { state: { from: `/animals/${animal.id}` } });
      return;
    }
    setStep('open');
  }

  function close() {
    setStep('closed');
    // Back to the button that opened the form, once it is rendered again.
    setTimeout(() => openRef.current?.focus(), 0);
  }

  return (
    <section className="space-y-4">
      {step === 'closed' ? (
        <button
          ref={openRef}
          type="button"
          onClick={open}
          className="min-h-11 rounded-control bg-brand-primary px-6 py-2 text-base font-semibold text-on-brand hover:bg-brand-primary-hover"
        >
          {t('adoptions.request.open')}
        </button>
      ) : null}
      {step === 'open' ? (
        <AdoptionRequestForm
          animal={animal}
          onSent={() => setStep('sent')}
          onActive={() => setStep('active')}
          onCancel={close}
        />
      ) : null}
      {step === 'sent' ? (
        <Notice focusOnMount>{t('adoptions.request.sent', { name: animal.name })}</Notice>
      ) : null}
      {step === 'active' ? (
        <Alert focusOnMount>{t('adoptions.request.errors.active')}</Alert>
      ) : null}
      {adminLink}
    </section>
  );
}

function AdoptionRequestForm({
  animal,
  onSent,
  onActive,
  onCancel,
}: {
  animal: Pick<AnimalDetail, 'id' | 'name'>;
  onSent(): void;
  onActive(): void;
  onCancel(): void;
}) {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { authorized } = useAuth();
  const titleId = useId();
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [tooLong, setTooLong] = useState(false);
  const [failed, setFailed] = useState(false);

  const mutation = useMutation({
    mutationFn: (body: CreateAdoptionRequest) =>
      authorized((accessToken) =>
        client.post<AdoptionRequestItem>(ADOPTION_REQUESTS_PATH, body, { accessToken }),
      ),
  });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (mutation.isPending) return;
    const trimmed = message.trim();
    if (trimmed.length > ADOPTION_MESSAGE_MAX_LENGTH) {
      setTooLong(true);
      boxRef.current?.focus();
      return;
    }
    setTooLong(false);
    setFailed(false);
    try {
      await mutation.mutateAsync({ animalId: animal.id, message: trimmed || null });
      onSent();
    } catch (error) {
      const code = error instanceof ApiError ? error.body?.code : undefined;
      if (code === 'ADOPTION_REQUEST_ACTIVE') onActive();
      // The animal changed meanwhile: reloading it shows why and hides this form.
      else if (code === 'ANIMAL_NOT_AVAILABLE') {
        await queryClient.invalidateQueries({ queryKey: ['animal', animal.id] });
      } else if (error instanceof ApiError && error.status === 400) {
        setTooLong(true);
        boxRef.current?.focus();
      } else setFailed(true);
    }
  }

  const pending = mutation.isPending;
  const max = ADOPTION_MESSAGE_MAX_LENGTH;

  return (
    <form
      aria-labelledby={titleId}
      noValidate
      onSubmit={(event) => void onSubmit(event)}
      className="space-y-4 rounded-control border border-border-input p-4"
    >
      <h2 id={titleId} className="text-xl font-bold text-text">
        {t('adoptions.request.title', { name: animal.name })}
      </h2>
      {failed ? <Alert focusOnMount>{t('adoptions.request.errors.generic')}</Alert> : null}
      <TextAreaField
        ref={boxRef}
        autoFocus
        label={t('adoptions.request.message.label')}
        hint={t('adoptions.request.message.hint', { max })}
        error={tooLong ? t('adoptions.request.errors.tooLong', { max }) : undefined}
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="flex flex-wrap gap-4">
        <Button type="submit" pending={pending} className="sm:w-auto">
          {pending ? t('adoptions.request.submitting') : t('adoptions.request.submit')}
        </Button>
        <button type="button" onClick={onCancel} className={secondaryButton}>
          {t('adoptions.request.cancel')}
        </button>
      </div>
      <p role="status" className="sr-only">
        {pending ? t('adoptions.request.submitting') : ''}
      </p>
    </form>
  );
}
