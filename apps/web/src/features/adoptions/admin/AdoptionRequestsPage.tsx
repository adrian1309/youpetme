import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ADOPTION_REQUEST_ACTIONS_BY_STATUS,
  ADOPTION_REQUEST_STATUSES,
  type AdoptionRequestAction,
  type AdoptionRequestItem,
  type AdoptionRequestStatus,
  type ListAdoptionRequestsResponse,
} from '@youpetme/contracts';
import {
  Ban,
  CalendarDays,
  Check,
  CheckCheck,
  CircleCheck,
  CircleX,
  Clock,
  Inbox,
  type LucideIcon,
  Mail,
  SlidersHorizontal,
  Undo2,
  X,
} from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { Notice } from '../../../components/Notice';
import { PageTitle } from '../../../components/PageTitle';
import { primaryButtonClass, secondaryButtonClass } from '../../../components/button-styles';
import { PillFieldset, PillOption } from '../../../components/PillChoice';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { useAuth } from '../../iam/auth/auth-state';
import { ADOPTION_REQUESTS_PATH } from '../request/AdoptionRequestSection';

/** `key` remounts the message, so the same text after another action is announced again. */
type Feedback = { kind: 'done' | 'error'; text: string; key: number };

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

  const hasFilters = Boolean(searchParams.get('status') || searchParams.get('animalId'));
  const status = searchParams.get('status') ?? '';

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-10">
      <PageTitle title={title} />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="flex size-12 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
          <Inbox aria-hidden="true" className="size-6" />
        </span>
        <h1 id={titleId} className="text-3xl font-bold text-text">
          {title}
        </h1>
        <p role="status" className="text-lg text-text-muted">
          {data ? t('adoptions.admin.results', { count: data.total }) : ''}
        </p>
      </div>

      <div className="rounded-card border border-border-subtle bg-surface p-5 shadow-soft">
        <PillFieldset
          legend={t('adoptions.admin.filters.status')}
          icon={<SlidersHorizontal aria-hidden="true" className="size-5 text-brand-primary" />}
        >
          {['', ...ADOPTION_REQUEST_STATUSES].map((value) => (
            <PillOption
              key={value || 'any'}
              type="radio"
              name="status"
              value={value}
              label={
                value
                  ? t(`adoptions.admin.statusFilter.${value}`)
                  : t('adoptions.admin.filters.any')
              }
              checked={status === value}
              onChange={() => setParam('status', value || null)}
            />
          ))}
        </PillFieldset>
      </div>
      {searchParams.get('animalId') ? (
        <p className="text-base text-text">
          {t('adoptions.admin.animalFilter')}{' '}
          <Link to={{ search: withoutAnimal.toString() }} onClick={() => setFeedback(null)}>
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
        <div className="flex flex-col items-center gap-3 rounded-card border border-border-subtle bg-surface px-6 py-12 text-center shadow-soft">
          <span className="flex size-20 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
            <Inbox aria-hidden="true" className="size-10" />
          </span>
          {hasFilters ? (
            <p className="text-base text-text">{t('adoptions.admin.empty')}</p>
          ) : (
            <>
              <h2 className="text-xl font-bold text-text">{t('adoptions.admin.emptyNone')}</h2>
              <p className="text-base text-text-muted">{t('adoptions.admin.emptyNoneBody')}</p>
            </>
          )}
        </div>
      ) : (
        <section aria-labelledby={titleId} className="space-y-4">
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
                className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
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
                className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
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

/** Status badge: icon, colour and text together; the text alone carries the meaning. */
const STATUS_BADGE: Record<AdoptionRequestStatus, { Icon: LucideIcon; className: string }> = {
  PENDING: { Icon: Clock, className: 'bg-accent-warm text-on-accent-warm' },
  APPROVED: { Icon: CircleCheck, className: 'bg-success-soft text-feedback-success' },
  REJECTED: { Icon: CircleX, className: 'bg-error-soft text-feedback-error' },
  COMPLETED: { Icon: CheckCheck, className: 'bg-accent-soft text-on-accent-soft' },
  CANCELLED: { Icon: Ban, className: 'bg-neutral-soft text-text-muted' },
};

function StatusBadge({ status }: { status: AdoptionRequestStatus }) {
  const { t } = useTranslation();
  const { Icon, className } = STATUS_BADGE[status];
  return (
    <p
      className={`inline-flex items-center gap-1.5 rounded-pill px-3 py-1 text-sm font-semibold ${className}`}
    >
      <Icon aria-hidden="true" className="size-4" />
      {t('adoptions.admin.item.status', { status: t(`adoptions.status.${status}`) })}
    </p>
  );
}

const ACTION_STYLE: Record<AdoptionRequestAction, { Icon: LucideIcon; className: string }> = {
  approve: { Icon: Check, className: primaryButtonClass },
  reject: {
    Icon: X,
    className:
      'inline-flex min-h-11 items-center justify-center gap-2 rounded-pill border-2 border-feedback-error bg-surface px-5 py-2 text-base font-semibold text-feedback-error hover:bg-error-soft',
  },
  complete: { Icon: CheckCheck, className: primaryButtonClass },
  cancel: { Icon: Undo2, className: secondaryButtonClass },
};

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
      className="space-y-4 rounded-card border border-border-subtle bg-surface p-5 shadow-soft"
    >
      <h2 id={headingId} className="sr-only">
        {t('adoptions.admin.item.title', { name: request.animal.name })}
      </h2>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xl font-bold">
          <Link to={`/animals/${request.animal.id}`} className="font-bold text-brand-primary">
            {request.animal.name}
          </Link>
        </p>
        <StatusBadge status={request.status} />
      </div>
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-accent-warm text-lg font-bold text-on-accent-warm"
        >
          {request.applicant.firstName.charAt(0).toUpperCase()}
        </span>
        <dl className="text-base text-text">
          <dt className="sr-only">{t('adoptions.admin.item.applicant')}</dt>
          <dd className="font-semibold">{applicant}</dd>
          <dd className="flex items-center gap-1.5 text-text-muted">
            <Mail aria-hidden="true" className="size-4" />
            <span>{request.applicant.email}</span>
          </dd>
        </dl>
      </div>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays aria-hidden="true" className="size-4" />
          {t('adoptions.admin.item.createdAt', { date: formatDate(request.createdAt) })}
        </span>
        {request.decidedAt ? (
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays aria-hidden="true" className="size-4" />
            {t('adoptions.admin.item.decidedAt', { date: formatDate(request.decidedAt) })}
          </span>
        ) : null}
        <span>
          {t('adoptions.admin.item.animalStatus', {
            status: t(`animals.status.${request.animal.status}`),
          })}
        </span>
      </p>
      {request.message ? (
        <blockquote className="whitespace-pre-line rounded-r-control border-l-4 border-accent-soft bg-page px-4 py-3 text-base text-text">
          {request.message}
        </blockquote>
      ) : (
        <p className="text-base italic text-text-muted">{t('adoptions.admin.item.noMessage')}</p>
      )}
      {actions.length > 0 ? (
        <div className="flex flex-wrap gap-3">
          {actions.map((action) => {
            const { Icon, className } = ACTION_STYLE[action];
            return (
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
                className={`${className} aria-disabled:cursor-wait aria-disabled:opacity-80`}
              >
                <Icon aria-hidden="true" className="size-5" />
                {t(`adoptions.admin.actions.${action}`)}
              </button>
            );
          })}
        </div>
      ) : null}
    </article>
  );
}
