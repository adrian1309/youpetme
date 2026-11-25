import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADOPTION_REQUEST_ACTIONS_BY_STATUS,
  ADOPTION_REQUEST_STATUSES,
  type AdoptionRequestAction,
  type AdoptionRequestItem,
  type ListAdoptionRequestsResponse,
} from '@youpetme/contracts';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { SelectField } from '../../../components/SelectField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';
import { ADOPTION_REQUESTS_PATH } from '../request/AdoptionRequestSection';

/** `key` remounts the message, so the same text after another action is announced again. */
type Feedback = { kind: 'done' | 'error'; text: string; key: number };

const actionButton =
  'min-h-11 rounded-control border-2 border-brand-primary px-4 py-2 text-base font-semibold text-brand-primary hover:bg-surface aria-disabled:cursor-wait aria-disabled:opacity-80';

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium' }).format(new Date(iso));

/**
 * `/admin/adoption-requests`: the ADMIN lists the requests, filters them by status (and by animal
 * through `?animalId=`) and applies the actions valid for each status (SCRUM-15). Wrapped in
 * RequireAdmin; the API enforces the role on its own.
 */
export function AdoptionRequestsPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const queryClient = useQueryClient();
  const { authorized } = useAuth();
  const titleId = useId();
  const [searchParams, setSearchParams] = useSearchParams();
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const apiQuery = new URLSearchParams();
  for (const key of ['status', 'animalId'] as const) {
    const value = searchParams.get(key);
    if (value) apiQuery.set(key, value);
  }
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  if (currentPage > 1) apiQuery.set('page', String(currentPage));
  const queryString = apiQuery.toString();

  const query = useQuery({
    queryKey: ['adoption-requests', queryString],
    queryFn: ({ signal }) =>
      authorized((accessToken) =>
        client.get<ListAdoptionRequestsResponse>(
          `${ADOPTION_REQUESTS_PATH}${queryString ? `?${queryString}` : ''}`,
          { accessToken, signal },
        ),
      ),
    placeholderData: keepPreviousData,
  });

  const mutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: AdoptionRequestAction }) =>
      authorized((accessToken) =>
        client.post<AdoptionRequestItem>(
          `${ADOPTION_REQUESTS_PATH}/${encodeURIComponent(id)}/${action}`,
          undefined,
          { accessToken },
        ),
      ),
  });

  async function act(request: AdoptionRequestItem, action: AdoptionRequestAction) {
    if (mutation.isPending) return;
    try {
      await mutation.mutateAsync({ id: request.id, action });
      const text = t(`adoptions.admin.done.${action}`, { name: request.animal.name });
      setFeedback((previous) => ({ kind: 'done', text, key: (previous?.key ?? 0) + 1 }));
    } catch (error) {
      const conflict = error instanceof ApiError && error.status === 409;
      const key = !conflict
        ? 'generic'
        : error.body?.code === 'ANIMAL_NOT_AVAILABLE'
          ? 'notAvailable'
          : 'changed';
      const text = t(`adoptions.admin.errors.${key}`);
      setFeedback((previous) => ({ kind: 'error', text, key: (previous?.key ?? 0) + 1 }));
    }
    // The list, and the animal's own pages, may have changed either way.
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['adoption-requests'] }),
      queryClient.invalidateQueries({ queryKey: ['animal', request.animal.id] }),
      queryClient.invalidateQueries({ queryKey: ['animals'] }),
    ]);
  }

  function setParam(key: 'status' | 'animalId', value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page');
    setSearchParams(next);
    setFeedback(null);
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(searchParams);
    if (target > 1) next.set('page', String(target));
    else next.delete('page');
    setSearchParams(next);
  }

  const withoutAnimal = new URLSearchParams(searchParams);
  withoutAnimal.delete('animalId');
  withoutAnimal.delete('page');

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const title = t('adoptions.admin.title');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-8">
      <PageTitle title={title} />
      <h1 id={titleId} className="text-3xl font-bold text-text">
        {title}
      </h1>

      <div className="grid gap-4 sm:grid-cols-3">
        <SelectField
          label={t('adoptions.admin.filters.status')}
          options={[
            { value: '', label: t('adoptions.admin.filters.any') },
            ...ADOPTION_REQUEST_STATUSES.map((value) => ({
              value,
              label: t(`adoptions.status.${value}`),
            })),
          ]}
          value={searchParams.get('status') ?? ''}
          onChange={(event) => setParam('status', event.target.value)}
        />
      </div>
      {searchParams.get('animalId') ? (
        <p className="text-base text-text">
          {t('adoptions.admin.animalFilter')}{' '}
          <Link
            to={{ search: withoutAnimal.toString() }}
            onClick={() => setFeedback(null)}
            className="font-medium text-brand-primary underline"
          >
            {t('adoptions.admin.showAll')}
          </Link>
        </p>
      ) : null}

      {feedback?.kind === 'done' ? (
        <Notice key={feedback.key} focusOnMount>
          {feedback.text}
        </Notice>
      ) : null}
      {feedback?.kind === 'error' ? (
        <Alert key={feedback.key} focusOnMount>
          {feedback.text}
        </Alert>
      ) : null}

      {query.isError ? (
        <Alert>{t('adoptions.admin.error')}</Alert>
      ) : !data ? (
        <p role="status" className="text-base text-text">
          {t('adoptions.admin.loading')}
        </p>
      ) : data.items.length === 0 ? (
        <p className="rounded-control border border-border-input bg-surface-muted p-6 text-base text-text">
          {t('adoptions.admin.empty')}
        </p>
      ) : (
        <section aria-labelledby={titleId} className="space-y-4">
          <p className="text-base text-text-muted">
            {t('adoptions.admin.results', { count: data.total })}
          </p>
          <ul className="space-y-4">
            {data.items.map((request) => (
              <li key={request.id}>
                <RequestCard
                  request={request}
                  pending={mutation.isPending}
                  onAction={(action) => void act(request, action)}
                />
              </li>
            ))}
          </ul>
          {pages > 1 ? (
            <nav
              aria-label={t('adoptions.admin.pagination.label')}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => goToPage(data.page - 1)}
                className={`${actionButton} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t('adoptions.admin.pagination.previous')}
              </button>
              <p className="text-base text-text">
                {t('adoptions.admin.pagination.page', { page: data.page, pages })}
              </p>
              <button
                type="button"
                disabled={data.page >= pages}
                onClick={() => goToPage(data.page + 1)}
                className={`${actionButton} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                {t('adoptions.admin.pagination.next')}
              </button>
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}

function RequestCard({
  request,
  pending,
  onAction,
}: {
  request: AdoptionRequestItem;
  pending: boolean;
  onAction(action: AdoptionRequestAction): void;
}) {
  const { t } = useTranslation();
  const headingId = useId();
  const applicant = `${request.applicant.firstName} ${request.applicant.lastName}`.trim();
  const actions = ADOPTION_REQUEST_ACTIONS_BY_STATUS[request.status];

  return (
    <article
      aria-labelledby={headingId}
      className="space-y-3 rounded-control border border-border-input p-4"
    >
      <h2 id={headingId} className="sr-only">
        {t('adoptions.admin.item.title', { name: request.animal.name })}
      </h2>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xl font-bold">
          <Link to={`/animals/${request.animal.id}`} className="text-brand-primary underline">
            {request.animal.name}
          </Link>
        </p>
        <p className="rounded-full border border-border-input bg-surface-muted px-3 py-1 text-sm font-semibold text-text">
          {t('adoptions.admin.item.status', { status: t(`adoptions.status.${request.status}`) })}
        </p>
      </div>
      <dl className="grid gap-1 text-base text-text sm:grid-cols-[auto_1fr] sm:gap-x-4">
        <dt className="font-semibold">{t('adoptions.admin.item.applicant')}</dt>
        <dd>
          <span>{applicant}</span> · <span>{request.applicant.email}</span>
        </dd>
      </dl>
      <p className="text-sm text-text-muted">
        {t('adoptions.admin.item.createdAt', { date: formatDate(request.createdAt) })}
        {request.decidedAt
          ? ` · ${t('adoptions.admin.item.decidedAt', { date: formatDate(request.decidedAt) })}`
          : ''}
        {` · ${t('adoptions.admin.item.animalStatus', { status: t(`animals.status.${request.animal.status}`) })}`}
      </p>
      <p className="whitespace-pre-line text-base text-text">
        {request.message ?? t('adoptions.admin.item.noMessage')}
      </p>
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => (
            <button
              key={action}
              type="button"
              aria-label={t('adoptions.admin.actions.label', {
                action: t(`adoptions.admin.actions.${action}`),
                applicant,
                name: request.animal.name,
              })}
              aria-disabled={pending || undefined}
              onClick={() => {
                if (!pending) onAction(action);
              }}
              className={actionButton}
            >
              {t(`adoptions.admin.actions.${action}`)}
            </button>
          ))}
        </div>
      ) : null}
    </article>
  );
}
