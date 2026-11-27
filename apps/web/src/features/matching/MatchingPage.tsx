import {
  MATCHING_DESCRIPTION_MAX_LENGTH,
  type MatchingRequest,
  type MatchingResponse,
} from '@youpetme/contracts';
import { useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Button } from '../../components/Button';
import { PageTitle } from '../../components/PageTitle';
import { TextAreaField } from '../../components/TextAreaField';
import { ApiError } from '../../lib/http/api-error';
import { useApiClient } from '../../lib/http/api-client-context';
import { writeMatchingProfile } from '../../lib/storage/matching-profile';
import { AnimalCard } from '../animals/catalogue/AnimalCard';
import { useAuth } from '../iam/auth/auth-state';
import { GREAT_FIT_SCORE, MATCHING_PATH } from './matching-api';

type MatchingError = 'unavailable' | 'rateLimited';

/**
 * `/matching` (SCRUM-16): the visitor describes what they look for in free text and gets up to
 * five AVAILABLE animals with the reasons they fit. A guest's profile stays in localStorage; for
 * a signed-in user the API saves it.
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

  const title = t('matching.title');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageTitle title={title} />
      <h1 className="mb-2 text-3xl font-bold text-text">{title}</h1>
      <p className="mb-2 text-base text-text">{t('matching.intro')}</p>
      <ul className="mb-6 list-disc pl-6 text-base text-text">
        {(['housing', 'activity', 'experience', 'family'] as const).map((tip) => (
          <li key={tip}>{t(`matching.tips.${tip}`)}</li>
        ))}
      </ul>

      <form onSubmit={submit} noValidate className="mb-8 flex max-w-2xl flex-col gap-4">
        <TextAreaField
          label={t('matching.form.label')}
          hint={t('matching.form.counter', {
            count: [...description].length,
            max: MATCHING_DESCRIPTION_MAX_LENGTH,
          })}
          error={fieldError}
          value={description}
          maxLength={MATCHING_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => setDescription(event.target.value)}
        />
        <Button type="submit" pending={pending} className="sm:w-auto sm:self-start">
          {t('matching.form.submit')}
        </Button>
      </form>

      {pending ? (
        <p role="status" className="text-base text-text-muted">
          {t('matching.searching')}
        </p>
      ) : null}

      {error && sent ? (
        <div
          role="alert"
          className="rounded-control border-2 border-feedback-error bg-surface-muted p-3 text-base text-feedback-error"
        >
          <p>{t(`matching.errors.${error}`)}</p>
          <button
            type="button"
            onClick={() => void search(sent)}
            className="mt-1 min-h-11 rounded-pill border-2 border-current px-4 font-bold"
          >
            {t('matching.retry')}
          </button>
        </div>
      ) : null}

      {response && response.results.length === 0 ? (
        <div className="rounded-control border border-border-input bg-surface-muted p-6">
          <h2 className="mb-2 text-xl font-bold text-text">{t('matching.empty.title')}</h2>
          <p className="mb-4 text-base text-text">{t('matching.empty.body')}</p>
          <Link to="/animals" className="font-bold text-brand-primary">
            {t('matching.empty.catalogue')}
          </Link>
        </div>
      ) : null}

      {response && response.results.length > 0 ? (
        <section aria-labelledby={resultsTitleId}>
          <h2 id={resultsTitleId} className="mb-4 text-2xl font-bold text-text">
            {t('matching.results.title')}
          </h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {response.results.map(({ animal, score, reasons }) => (
              <AnimalCard key={animal.id} animal={animal}>
                <p className="font-semibold text-brand-primary">
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
