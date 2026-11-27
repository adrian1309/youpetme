import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AGE_GROUPS, type ListAnimalsResponse, SIZES, SPECIES } from '@youpetme/contracts';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { CheckboxField } from '../../../components/CheckboxField';
import { PageTitle } from '../../../components/PageTitle';
import { SelectField } from '../../../components/SelectField';
import { useApiClient } from '../../../lib/http/api-client-context';
import { useAuth } from '../../iam/auth/auth-state';
import { ANIMALS_PATH } from '../animal-tags';
import { AnimalCard } from './AnimalCard';

/** Query parameters the catalogue keeps in the URL and forwards to the API as they are. */
const FILTER_KEYS = [
  'species',
  'size',
  'ageGroup',
  'compatibleWithChildren',
  'compatibleWithOtherAnimals',
] as const;

/** `/animals`: public catalogue of AVAILABLE animals with filters (SCRUM-12). */
export function CataloguePage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { session } = useAuth();
  const titleId = useId();
  const [searchParams, setSearchParams] = useSearchParams();

  const apiQuery = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    const value = searchParams.get(key);
    if (value) apiQuery.set(key, value);
  }
  const currentPage = Number(searchParams.get('page') ?? '1') || 1;
  if (currentPage > 1) apiQuery.set('page', String(currentPage));
  const queryString = apiQuery.toString();

  const query = useQuery({
    queryKey: ['animals', queryString],
    queryFn: ({ signal }) =>
      client.get<ListAnimalsResponse>(`${ANIMALS_PATH}${queryString ? `?${queryString}` : ''}`, {
        signal,
      }),
    placeholderData: keepPreviousData,
  });

  function setFilter(key: (typeof FILTER_KEYS)[number], value: string | null) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete('page'); // A new filter starts again from the first page.
    setSearchParams(next);
  }

  function goToPage(target: number) {
    const next = new URLSearchParams(searchParams);
    if (target > 1) next.set('page', String(target));
    else next.delete('page');
    setSearchParams(next);
  }

  const options = (key: string, values: readonly string[]) => [
    { value: '', label: t('animals.catalogue.filters.any') },
    ...values.map((value) => ({ value, label: t(`animals.${key}.${value}`) })),
  ];

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const title = t('animals.catalogue.title');

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <PageTitle title={title} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 id={titleId} className="text-3xl font-bold text-text">
          {title}
        </h1>
        {session?.user.role === 'ADMIN' ? (
          <Link to="/admin/animals/new" className="font-bold text-brand-primary">
            {t('animals.catalogue.addAnimal')}
          </Link>
        ) : null}
      </div>

      <fieldset className="mb-6 grid gap-4 rounded-control border border-border-input p-4 sm:grid-cols-3">
        <legend className="px-1 text-base font-semibold text-text">
          {t('animals.catalogue.filters.legend')}
        </legend>
        <SelectField
          label={t('animals.catalogue.filters.species')}
          options={options('species', SPECIES)}
          value={searchParams.get('species') ?? ''}
          onChange={(event) => setFilter('species', event.target.value)}
        />
        <SelectField
          label={t('animals.catalogue.filters.size')}
          options={options('size', SIZES)}
          value={searchParams.get('size') ?? ''}
          onChange={(event) => setFilter('size', event.target.value)}
        />
        <SelectField
          label={t('animals.catalogue.filters.ageGroup')}
          options={options('ageGroup', AGE_GROUPS)}
          value={searchParams.get('ageGroup') ?? ''}
          onChange={(event) => setFilter('ageGroup', event.target.value)}
        />
        <CheckboxField
          label={t('animals.catalogue.filters.compatibleWithChildren')}
          checked={searchParams.get('compatibleWithChildren') === 'true'}
          onChange={(event) =>
            setFilter('compatibleWithChildren', event.target.checked ? 'true' : null)
          }
        />
        <CheckboxField
          label={t('animals.catalogue.filters.compatibleWithOtherAnimals')}
          checked={searchParams.get('compatibleWithOtherAnimals') === 'true'}
          onChange={(event) =>
            setFilter('compatibleWithOtherAnimals', event.target.checked ? 'true' : null)
          }
        />
      </fieldset>

      {query.isError ? (
        <Alert>{t('animals.catalogue.error')}</Alert>
      ) : !data ? (
        <CatalogueSkeleton label={t('animals.catalogue.loading')} />
      ) : data.items.length === 0 ? (
        <div className="rounded-control border border-border-input bg-surface-muted p-6">
          <h2 className="mb-2 text-xl font-bold text-text">{t('animals.catalogue.empty.title')}</h2>
          <p className="mb-4 text-base text-text">{t('animals.catalogue.empty.body')}</p>
          <button
            type="button"
            onClick={() => setSearchParams(new URLSearchParams())}
            className="min-h-11 rounded-control border-2 border-brand-primary px-4 py-2 text-base font-semibold text-brand-primary hover:bg-surface"
          >
            {t('animals.catalogue.empty.clear')}
          </button>
        </div>
      ) : (
        <section aria-labelledby={titleId}>
          <p role="status" className="mb-4 text-base text-text-muted">
            {t('animals.catalogue.results', { count: data.total })}
          </p>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </ul>
          {pages > 1 ? (
            <nav
              aria-label={t('animals.catalogue.pagination.label')}
              className="mt-6 flex flex-wrap items-center justify-center gap-4"
            >
              <PageButton disabled={data.page <= 1} onClick={() => goToPage(data.page - 1)}>
                {t('animals.catalogue.pagination.previous')}
              </PageButton>
              <p className="text-base text-text">
                {t('animals.catalogue.pagination.page', { page: data.page, pages })}
              </p>
              <PageButton disabled={data.page >= pages} onClick={() => goToPage(data.page + 1)}>
                {t('animals.catalogue.pagination.next')}
              </PageButton>
            </nav>
          ) : null}
        </section>
      )}
    </div>
  );
}

function PageButton({
  disabled,
  onClick,
  children,
}: {
  disabled: boolean;
  onClick(): void;
  children: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="min-h-11 rounded-control border-2 border-brand-primary px-4 py-2 text-base font-semibold text-brand-primary hover:bg-surface disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}

/** Skeleton shaped like the cards (Design System — Skeleton over blank). */
function CatalogueSkeleton({ label }: { label: string }) {
  return (
    <div>
      <p role="status" className="sr-only">
        {label}
      </p>
      <ul aria-hidden="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li key={index} className="h-72 animate-pulse rounded-control bg-surface-muted" />
        ))}
      </ul>
    </div>
  );
}
