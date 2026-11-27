import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ADOPTION_MESSAGE_MAX_LENGTH,
  type AdoptionRequestItem,
  type AnimalDetail,
  type CreateAdoptionRequest,
} from '@youpetme/contracts';
import { Check, Heart, Inbox, Send } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router';

import { Alert } from '../../../components/Alert';
import { AnimalPhoto } from '../../../components/AnimalPhoto';
import { Button } from '../../../components/Button';
import { buttonClass, secondaryButtonClass } from '../../../components/button-styles';
import { Notice } from '../../../components/Notice';
import { TextAreaField } from '../../../components/TextAreaField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';

export const ADOPTION_REQUESTS_PATH = '/api/v1/adoption-requests';

type Step = 'closed' | 'open' | 'sent' | 'active';
type RequestAnimal = Pick<AnimalDetail, 'id' | 'name' | 'status' | 'photoUrls'>;

/**
 * At the end of the animal page: the "¿Te lo llevas a casa?" card of an AVAILABLE animal, whose
 * "Solicitar adopción" opens the request form in a modal dialog (SCRUM-14, SCRUM-56). An ADMIN
 * sees only the link to that animal's requests (SCRUM-15); hiding the action is UI only. A
 * visitor is sent to /login and comes back here after signing in. The API checks everything again.
 */
export function AdoptionRequestSection({ animal }: { animal: RequestAnimal }) {
  const { t } = useTranslation();
  const { session } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>('closed');
  const openRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  if (session?.user.role === 'ADMIN') {
    return (
      <Link
        to={`/admin/adoption-requests?animalId=${encodeURIComponent(animal.id)}`}
        className={secondaryButtonClass}
      >
        <Inbox aria-hidden="true" className="size-5" />
        {t('adoptions.request.adminLink', { name: animal.name })}
      </Link>
    );
  }

  if (animal.status !== 'AVAILABLE') return null;

  function open() {
    if (step === 'sent') return;
    if (!session) {
      void navigate('/login', { state: { from: `/animals/${animal.id}` } });
      return;
    }
    setStep('open');
  }

  function close() {
    setStep((current) => (current === 'open' ? 'closed' : current));
    // Back to the button that opened the dialog.
    setTimeout(() => openRef.current?.focus(), 0);
  }

  const sent = step === 'sent';

  return (
    <section
      aria-labelledby={titleId}
      className="space-y-4 rounded-card border border-border-subtle bg-surface p-5 shadow-soft"
    >
      <h2 id={titleId} className="flex items-center gap-2 text-xl font-bold text-text">
        <Heart aria-hidden="true" className="size-6 text-brand-primary" />
        {t('adoptions.request.cardTitle')}
      </h2>
      <p className="text-base text-text-muted">{t('adoptions.request.cardBody')}</p>
      <button
        ref={openRef}
        type="button"
        onClick={open}
        aria-disabled={sent || undefined}
        className={`${buttonClass('primary', 'lg')} w-full aria-disabled:cursor-not-allowed`}
      >
        {sent ? <Check aria-hidden="true" className="size-5" /> : null}
        {sent ? t('adoptions.request.sentButton') : t('adoptions.request.open')}
      </button>
      {sent ? <Notice focusOnMount>{t('adoptions.request.sent')}</Notice> : null}
      {step === 'active' ? (
        <Alert focusOnMount>{t('adoptions.request.errors.active')}</Alert>
      ) : null}
      {step === 'open' ? (
        <AdoptionRequestDialog
          animal={animal}
          onSent={() => setStep('sent')}
          onActive={() => setStep('active')}
          onClose={close}
        />
      ) : null}
    </section>
  );
}

/** Modal dialog (native <dialog>: focus trap and Escape come from the browser). */
function AdoptionRequestDialog({
  animal,
  onSent,
  onActive,
  onClose,
}: {
  animal: RequestAnimal;
  onSent(): void;
  onActive(): void;
  onClose(): void;
}) {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { authorized } = useAuth();
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);
  const [message, setMessage] = useState('');
  const [tooLong, setTooLong] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

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
      // The animal changed meanwhile: reloading it shows why and removes the card.
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
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-card bg-surface p-6 text-text shadow-soft backdrop:bg-text/50"
    >
      <form
        aria-labelledby={titleId}
        noValidate
        onSubmit={(event) => void onSubmit(event)}
        className="space-y-4"
      >
        <div className="flex items-center gap-4">
          <AnimalPhoto
            src={animal.photoUrls[0]}
            alt=""
            name={animal.name}
            className="size-16 shrink-0 rounded-pill"
          />
          <h2 id={titleId} className="text-xl font-bold text-text">
            {t('adoptions.request.title', { name: animal.name })}
          </h2>
        </div>
        {failed ? <Alert focusOnMount>{t('adoptions.request.errors.generic')}</Alert> : null}
        <div>
          <TextAreaField
            ref={boxRef}
            autoFocus
            label={t('adoptions.request.message.label')}
            hint={t('adoptions.request.message.hint', { max })}
            error={tooLong ? t('adoptions.request.errors.tooLong', { max }) : undefined}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <p aria-hidden="true" className="mt-1 text-right text-sm text-text-muted">
            {t('adoptions.request.counter', { count: [...message].length, max })}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" pending={pending} className="sm:w-auto">
            <Send aria-hidden="true" className="size-5" />
            {pending ? t('adoptions.request.submitting') : t('adoptions.request.submit')}
          </Button>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            className={secondaryButtonClass}
          >
            {t('adoptions.request.cancel')}
          </button>
        </div>
        <p role="status" className="sr-only">
          {pending ? t('adoptions.request.submitting') : ''}
        </p>
      </form>
    </dialog>
  );
}
