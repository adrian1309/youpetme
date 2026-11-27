import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AGE_GROUPS, type ListAnimalsResponse, SIZES, SPECIES } from '@youpetme/contracts';
import { Baby, Cake, Check, PawPrint, Ruler, Search, SearchX } from 'lucide-react';
import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { primaryButtonClass, secondaryButtonClass } from '../../../components/Button';
import { PageTitle } from '../../../components/PageTitle';
import { useApiClient } from '../../../lib/http/api-client-context';
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
type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Record<FilterKey, string>;

function readFilters(params: URLSearchParams): Filters {
  return Object.fromEntries(FILTER_KEYS.map((key) => [key, params.get(key) ?? ''])) as Filters;
}

const iconClass = 'size-5 text-brand-primary';

/** `/animals`: public catalogue of AVAILABLE animals with filters (SCRUM-12, SCRUM-56). */
export function CataloguePage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const titleId = useId();
  const [searchParams, setSearchParams] = useSearchParams();

  const applied = readFilters(searchParams);
  const apiQuery = new URLSearchParams();
  for (const key of FILTER_KEYS) {
    if (applied[key]) apiQuery.set(key, applied[key]);
  }
  const hasFilters = apiQuery.size > 0;
  const filtersKey = apiQuery.toString();
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

  /** "Buscar": the chosen filters go to the URL (and so to the API), from the first page. */
  function apply(filters: Filters) {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) {
      if (filters[key]) next.set(key, filters[key]);
    }
    setSearchParams(next);
  }

  const clear = () => setSearchParams(new URLSearchParams());

  function goToPage(target: number) {
    const next = new URLSearchParams(searchParams);
    if (target > 1) next.set('page', String(target));
    else next.delete('page');
    setSearchParams(next);
  }

  const data = query.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const title = t('animals.catalogue.title');

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <PageTitle title={title} />
      <div className="mb-6 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h1 id={titleId} className="text-3xl font-bold text-text">
          {title}
        </h1>
        <p role="status" className="text-lg text-text-muted">
          {data ? t('animals.catalogue.results', { count: data.total }) : ''}
        </p>
      </div>

      {/* Remounted when the applied filters change, so the draft starts from them again. */}
      <FilterForm key={filtersKey} initial={applied} onApply={apply} onClear={clear} />

      {query.isError ? (
        <Alert>{t('animals.catalogue.error')}</Alert>
      ) : !data ? (
        <CatalogueSkeleton label={t('animals.catalogue.loading')} />
      ) : data.items.length === 0 ? (
        hasFilters ? (
          <EmptyState icon={<SearchX aria-hidden="true" className="size-12" />}>
            <h2 className="text-xl font-bold text-text">{t('animals.catalogue.empty.title')}</h2>
            <p className="text-base text-text">{t('animals.catalogue.empty.body')}</p>
            <button type="button" onClick={clear} className={secondaryButtonClass}>
              {t('animals.catalogue.empty.clear')}
            </button>
          </EmptyState>
        ) : (
          <EmptyState icon={<PawPrint aria-hidden="true" className="size-12" />}>
            <h2 className="text-xl font-bold text-text">
              {t('animals.catalogue.noAnimals.title')}
            </h2>
            <p className="text-base text-text">{t('animals.catalogue.noAnimals.body')}</p>
          </EmptyState>
        )
      ) : (
        <section aria-labelledby={titleId}>
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.items.map((animal) => (
              <AnimalCard key={animal.id} animal={animal} />
            ))}
          </ul>
          {pages > 1 ? (
            <nav
              aria-label={t('animals.catalogue.pagination.label')}
              className="mt-8 flex flex-wrap items-center justify-center gap-4"
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

/** Filter card: pill choices are a draft until "Buscar" applies them (SCRUM-56). */
function FilterForm({
  initial,
  onApply,
  onClear,
}: {
  initial: Filters;
  onApply(filters: Filters): void;
  onClear(): void;
}) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(initial);
  const set = (key: FilterKey, value: string) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const options = (key: string, values: readonly string[]) => [
    { value: '', label: t('animals.catalogue.filters.any') },
    ...values.map((value) => ({ value, label: t(`animals.${key}.${value}`) })),
  ];

  function submit(event: FormEvent) {
    event.preventDefault();
    onApply(draft);
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 space-y-5 rounded-card border border-border-subtle bg-surface p-5 shadow-soft"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        <PillRadioGroup
          legend={t('animals.catalogue.filters.species')}
          icon={<PawPrint aria-hidden="true" className={iconClass} />}
          name="species"
          options={options('species', SPECIES)}
          value={draft.species}
          onChange={(value) => set('species', value)}
        />
        <PillRadioGroup
          legend={t('animals.catalogue.filters.size')}
          icon={<Ruler aria-hidden="true" className={iconClass} />}
          name="size"
          options={options('size', SIZES)}
          value={draft.size}
          onChange={(value) => set('size', value)}
        />
        <PillRadioGroup
          legend={t('animals.catalogue.filters.ageGroup')}
          icon={<Cake aria-hidden="true" className={iconClass} />}
          name="ageGroup"
          options={options('ageGroup', AGE_GROUPS)}
          value={draft.ageGroup}
          onChange={(value) => set('ageGroup', value)}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <PillCheckbox
          label={t('animals.catalogue.filters.compatibleWithChildren')}
          icon={<Baby aria-hidden="true" className="size-5" />}
          checked={draft.compatibleWithChildren === 'true'}
          onChange={(checked) => set('compatibleWithChildren', checked ? 'true' : '')}
        />
        <PillCheckbox
          label={t('animals.catalogue.filters.compatibleWithOtherAnimals')}
          icon={<PawPrint aria-hidden="true" className="size-5" />}
          checked={draft.compatibleWithOtherAnimals === 'true'}
          onChange={(checked) => set('compatibleWithOtherAnimals', checked ? 'true' : '')}
        />
      </div>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButtonClass}>
          <Search aria-hidden="true" className="size-5" />
          {t('animals.catalogue.filters.search')}
        </button>
        <button type="button" onClick={onClear} className={secondaryButtonClass}>
          {t('animals.catalogue.filters.clear')}
        </button>
      </div>
    </form>
  );
}

/** Pill look of a radio or checkbox; the hidden input keeps the keyboard and the role. */
const pillClass =
  'inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border-2 border-border-input bg-surface px-4 text-base font-medium text-text hover:border-brand-primary peer-checked:border-brand-primary peer-checked:bg-brand-primary peer-checked:text-on-brand peer-focus-visible:outline-3 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-primary';

function PillRadioGroup({
  legend,
  icon,
  name,
  options,
  value,
  onChange,
}: {
  legend: string;
  icon: ReactNode;
  name: string;
  options: { value: string; label: string }[];
  value: string;
  onChange(value: string): void;
}) {
  return (
    <fieldset>
      <legend className="mb-2 flex items-center gap-2 text-base font-semibold text-text">
        {icon}
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <label key={option.value}>
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="peer sr-only"
              />
              <span className={pillClass}>
                {/* The check mark tells the choice apart without relying on colour. */}
                {checked ? <Check aria-hidden="true" className="size-4" /> : null}
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function PillCheckbox({
  label,
  icon,
  checked,
  onChange,
}: {
  label: string;
  icon: ReactNode;
  checked: boolean;
  onChange(checked: boolean): void;
}) {
  return (
    <label>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className={pillClass}>
        {checked ? <Check aria-hidden="true" className="size-4" /> : icon}
        {label}
      </span>
    </label>
  );
}

/** Friendly empty state with a big icon (Design System — Empty states). */
function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col items-center gap-4 rounded-card border border-border-subtle bg-surface px-6 py-12 text-center shadow-soft">
      <div className="flex size-24 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
        {icon}
      </div>
      {children}
    </section>
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
      className={`${secondaryButtonClass} disabled:cursor-not-allowed disabled:opacity-50`}
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
      <ul aria-hidden="true" className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((index) => (
          <li key={index} className="h-80 rounded-card bg-surface motion-safe:animate-pulse" />
        ))}
      </ul>
    </div>
  );
}
