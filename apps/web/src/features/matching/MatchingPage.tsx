import {
  MATCHING_DESCRIPTION_MAX_LENGTH,
  type MatchingRequest,
  type MatchingResponse,
} from '@youpetme/contracts';
import { Activity, House, LoaderCircle, Sparkles, Star, Users } from 'lucide-react';
import { useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '../../components/Button';
import { secondaryButtonClass } from '../../components/button-styles';
import { PageTitle } from '../../components/PageTitle';
import { TextAreaField } from '../../components/TextAreaField';
import { ApiError } from '../../lib/http/api-error';
import { useApiClient } from '../../lib/http/api-client-context';
import { writeMatchingProfile } from '../../lib/storage/matching-profile';
import { AnimalCard } from '../animals/catalogue/AnimalCard';
import { DiangoMascot } from '../assistant/DiangoMascot';
import { useAuth } from '../iam/auth/auth-state';
import { GREAT_FIT_SCORE, MATCHING_PATH } from './matching-api';

type MatchingError = 'unavailable' | 'rateLimited';

const TIPS = [
  { key: 'housing', Icon: House },
  { key: 'activity', Icon: Activity },
  { key: 'experience', Icon: Star },
  { key: 'family', Icon: Users },
] as const;

const EXAMPLES = ['flat', 'children', 'firstTime', 'running', 'otherDog'] as const;
const LOADING_MESSAGES = ['sniffing', 'candidates', 'almost'] as const;
const LOADING_MESSAGE_MS = 2000;

const MAX = MATCHING_DESCRIPTION_MAX_LENGTH;

/** Appends an example to the description ("." between sentences), never past the limit. */
function appendExample(current: string, example: string): string {
  const base = current.trimEnd();
  const next = base ? `${base}${/[.!?]$/.test(base) ? ' ' : '. '}${example}` : example;
  return [...next].length > MAX ? current : next;
}

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * `/matching` (SCRUM-16, SCRUM-56): the visitor tells Diango about themselves in free text and
 * gets up to five AVAILABLE animals with the reasons they fit. A guest's profile stays in
 * localStorage; for a signed-in user the API saves it.
 */
export function MatchingPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { isAuthenticated, authorized } = useAuth();
  const resultsTitleId = useId();
  const [description, setDescription] = useState('');
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<MatchingError | null>(null);
  const [response, setResponse] = useState<MatchingResponse | null>(null);

  async function search(text: string): Promise<void> {
    setSent(text);
    setPending(true);
    setError(null);
    setResponse(null);
    const body: MatchingRequest = { description: text };
    try {
      const result = isAuthenticated
        ? await authorized((accessToken) =>
            client.post<MatchingResponse>(MATCHING_PATH, body, { accessToken }),
          )
        : await client.post<MatchingResponse>(MATCHING_PATH, body);
      if (!isAuthenticated) writeMatchingProfile(result.profile);
      setResponse(result);
    } catch (failure) {
      setError(
        failure instanceof ApiError && failure.status === 429 ? 'rateLimited' : 'unavailable',
      );
    } finally {
      setPending(false);
    }
  }

  function submit(event: FormEvent): void {
    event.preventDefault();
    if (pending) return;
    const text = description.trim();
    if (!text) {
      setFieldError(t('matching.form.required'));
      return;
    }
    setFieldError(undefined);
    void search(text);
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10">
      <PageTitle title={t('matching.title')} />
      <header className="mb-8 flex flex-col items-center text-center">
        <span className="mb-4 flex size-28 items-center justify-center rounded-pill bg-accent-soft">
          <DiangoMascot className="size-20" />
        </span>
        <h1 className="text-3xl font-bold text-text">{t('matching.heading')}</h1>
        <p className="mt-2 text-lg text-text-muted">{t('matching.intro')}</p>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:justify-center">
          {TIPS.map(({ key, Icon }) => (
            <li
              key={key}
              className="inline-flex items-center justify-center gap-2 rounded-pill bg-surface px-4 py-2 text-sm font-medium text-text shadow-soft"
            >
              <Icon aria-hidden="true" className="size-4 text-brand-primary" />
              {t(`matching.tips.${key}`)}
            </li>
          ))}
        </ul>
      </header>

      <form
        onSubmit={submit}
        noValidate
        className="mx-auto mb-10 flex max-w-2xl flex-col gap-4 rounded-card border border-border-subtle bg-surface p-6 shadow-soft"
      >
        <TextAreaField
          label={t('matching.form.label')}
          hint={t('matching.form.counter', { count: [...description].length, max: MAX })}
          error={fieldError}
          value={description}
          maxLength={MAX}
          rows={6}
          onChange={(event) => setDescription(event.target.value)}
        />
        <div>
          <p className="mb-2 text-sm font-medium text-text-muted">{t('matching.examples.label')}</p>
          <ul className="flex flex-wrap gap-2">
            {EXAMPLES.map((key) => {
              const text = t(`matching.examples.${key}`);
              return (
                <li key={key}>
                  <button
                    type="button"
                    onClick={() => setDescription((current) => appendExample(current, text))}
                    className="min-h-11 rounded-pill bg-accent-warm px-4 text-sm font-medium text-on-accent-warm hover:brightness-95"
                  >
                    {text}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <Button type="submit" pending={pending} size="lg">
          {pending ? (
            <LoaderCircle aria-hidden="true" className="size-5 motion-safe:animate-spin" />
          ) : (
            <Sparkles aria-hidden="true" className="size-5" />
          )}
          {t('matching.form.submit')}
        </Button>
      </form>

      {pending ? <MatchingLoading /> : null}

      {error && sent ? (
        <div
          role="alert"
          className="rounded-card border-2 border-feedback-error bg-surface p-4 text-base text-feedback-error"
        >
          <p>{t(`matching.errors.${error}`)}</p>
          <button
            type="button"
            onClick={() => void search(sent)}
            className="mt-2 min-h-11 rounded-pill border-2 border-current px-4 font-bold"
          >
            {t('matching.retry')}
          </button>
        </div>
      ) : null}

      {response && response.results.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-card border border-border-subtle bg-surface px-6 py-10 text-center shadow-soft">
          <DiangoMascot className="size-16" />
          <h2 className="text-xl font-bold text-text">{t('matching.empty.title')}</h2>
          <p className="text-base text-text">{t('matching.empty.body')}</p>
          <Link to="/animals" className={secondaryButtonClass}>
            {t('matching.empty.catalogue')}
          </Link>
        </div>
      ) : null}

      {response && response.results.length > 0 ? (
        <section aria-labelledby={resultsTitleId}>
          <h2 id={resultsTitleId} className="mb-6 text-2xl font-bold text-text">
            {t('matching.results.title')}
          </h2>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {response.results.map(({ animal, score, reasons }) => (
              <AnimalCard key={animal.id} animal={animal}>
                <p className="inline-flex items-center gap-1.5 self-start rounded-pill bg-accent-warm px-3 py-1 text-sm font-semibold text-on-accent-warm">
                  <Sparkles aria-hidden="true" className="size-4" />
                  {score >= GREAT_FIT_SCORE
                    ? t('matching.results.greatFit')
                    : t('matching.results.goodFit')}
                </p>
                <ul
                  aria-label={t('matching.results.reasons')}
                  className="list-disc pl-5 text-base text-text"
                >
                  {reasons.map((reason) => (
                    <li key={reason}>{t(`matching.reasons.${reason}`)}</li>
                  ))}
                </ul>
              </AnimalCard>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/**
 * Waiting card: Diango bouncing and a message that changes every ~2 s, then three shimmering
 * skeletons. Screen readers hear "Buscando tu compañero" once; the rotating text is hidden from
 * them. Under prefers-reduced-motion nothing moves and the message stays put.
 */
function MatchingLoading() {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % LOADING_MESSAGES.length),
      LOADING_MESSAGE_MS,
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <p className="sr-only">{t('matching.loading.announce')}</p>
      <div
        aria-hidden="true"
        className="flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-surface px-6 py-8 text-center shadow-soft"
      >
        <span className="flex size-24 items-center justify-center rounded-pill bg-accent-soft">
          <DiangoMascot className="diango-bounce size-16" />
        </span>
        <p className="text-lg font-semibold text-text">
          {t(`matching.loading.${LOADING_MESSAGES[index]!}`)}
        </p>
      </div>
      <ul aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((key) => (
          <li key={key} className="h-80 rounded-card bg-surface motion-safe:animate-pulse" />
        ))}
      </ul>
    </div>
  );
}
