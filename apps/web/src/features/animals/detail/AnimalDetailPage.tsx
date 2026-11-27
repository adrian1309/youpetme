import { useQuery } from '@tanstack/react-query';
import type { AnimalDetail } from '@youpetme/contracts';
import { ArrowLeft, HeartPulse, Info } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { AnimalPhoto } from '../../../components/AnimalPhoto';
import { secondaryButtonClass } from '../../../components/Button';
import { PageTitle } from '../../../components/PageTitle';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { AdoptionRequestSection } from '../../adoptions/request/AdoptionRequestSection';
import {
  AgeIcon,
  ANIMALS_PATH,
  CompatibilityIcon,
  SizeIcon,
  SpeciesIcon,
  Tag,
} from '../animal-tags';

/** The gallery shows up to this many photos. */
const MAX_PHOTOS = 5;

/** `/animals/:id`: public detail of an animal, in any status (SCRUM-13, SCRUM-56). */
export function AnimalDetailPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['animal', id],
    queryFn: ({ signal }) =>
      client.get<AnimalDetail>(`${ANIMALS_PATH}/${encodeURIComponent(id)}`, { signal }),
  });

  let content;
  if (query.data) {
    content = <AnimalDetailView animal={query.data} />;
  } else if (query.error instanceof ApiError && query.error.status === 404) {
    const title = t('animals.detail.notFound.title');
    content = (
      <>
        <PageTitle title={title} />
        <h1 className="mb-4 text-3xl font-bold text-text">{title}</h1>
        <p className="text-base text-text">{t('animals.detail.notFound.body')}</p>
      </>
    );
  } else if (query.isError) {
    content = <Alert>{t('animals.detail.error')}</Alert>;
  } else {
    content = (
      <div>
        <p role="status" className="sr-only">
          {t('animals.detail.loading')}
        </p>
        <div
          aria-hidden="true"
          className="h-96 rounded-card bg-surface motion-safe:animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8">
      <Link to="/animals" className={secondaryButtonClass}>
        <ArrowLeft aria-hidden="true" className="size-5" />
        {t('animals.detail.back')}
      </Link>
      {content}
    </div>
  );
}

function AnimalDetailView({ animal }: { animal: AnimalDetail }) {
  const { t } = useTranslation();
  const compatibility = [
    { kind: 'children', value: animal.compatibleWithChildren },
    { kind: 'otherAnimals', value: animal.compatibleWithOtherAnimals },
  ] as const;

  return (
    <article className="grid gap-8 lg:grid-cols-2">
      <PageTitle title={animal.name} />
      <Gallery animal={animal} />

      <div className="space-y-6">
        <header>
          <h1 className="text-4xl font-bold text-text">{animal.name}</h1>
          {animal.breed ? <p className="mt-1 text-xl text-text-muted">{animal.breed}</p> : null}
        </header>

        {animal.status !== 'AVAILABLE' ? (
          <p className="flex gap-2 rounded-card border-2 border-border-input bg-surface p-3 text-base font-semibold text-text">
            <Info aria-hidden="true" className="size-5 shrink-0" />
            <span>
              {t('animals.detail.notAvailable', { status: t(`animals.status.${animal.status}`) })}
            </span>
          </p>
        ) : null}

        <ul className="flex flex-wrap gap-2" aria-label={t('animals.detail.characteristics')}>
          <Tag icon={<SpeciesIcon species={animal.species} />}>
            {t(`animals.species.${animal.species}`)}
          </Tag>
          <Tag icon={<SizeIcon />}>{t(`animals.size.${animal.size}`)}</Tag>
          <Tag icon={<AgeIcon />}>{t(`animals.ageGroup.${animal.ageGroup}`)}</Tag>
        </ul>

        {animal.temperament.length > 0 ? (
          <Section title={t('animals.detail.temperament')}>
            <ul className="flex flex-wrap gap-2">
              {animal.temperament.map((tag) => (
                <Tag key={tag}>{t(`animals.temperament.${tag}`)}</Tag>
              ))}
            </ul>
          </Section>
        ) : null}

        <Section title={t('animals.detail.compatibility')}>
          <ul className="space-y-2">
            {compatibility.map(({ kind, value }) => (
              <li key={kind} className="flex items-center gap-2 text-base text-text">
                <span className="flex size-8 items-center justify-center rounded-pill bg-accent-soft text-on-accent-soft">
                  <CompatibilityIcon value={value} />
                </span>
                {t(`animals.compatibility.${kind}.${String(value)}`)}
              </li>
            ))}
          </ul>
        </Section>

        {animal.careNotes ? (
          <section className="rounded-card border border-border-subtle bg-surface p-5 shadow-soft">
            <h2 className="mb-2 flex items-center gap-2 text-xl font-bold text-text">
              <HeartPulse aria-hidden="true" className="size-5 text-brand-primary" />
              {t('animals.detail.careNotes')}
            </h2>
            <p className="whitespace-pre-line text-base text-text">{animal.careNotes}</p>
          </section>
        ) : null}

        <AdoptionRequestSection animal={animal} />
      </div>
    </article>
  );
}

/** Main photo and, with several photos, thumbnail buttons that switch it. */
function Gallery({ animal }: { animal: AnimalDetail }) {
  const { t } = useTranslation();
  const photos = animal.photoUrls.slice(0, MAX_PHOTOS);
  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-3">
      <AnimalPhoto
        src={photos[selected]}
        alt={t('animals.detail.photo', { index: selected + 1, name: animal.name })}
        name={animal.name}
        className="aspect-[4/3] w-full rounded-card"
      />
      {photos.length > 1 ? (
        <ul className="flex flex-wrap gap-3">
          {photos.map((url, index) => (
            <li key={url}>
              <button
                type="button"
                aria-label={t('animals.detail.thumbnail', { index: index + 1, name: animal.name })}
                aria-pressed={index === selected}
                onClick={() => setSelected(index)}
                className="block overflow-hidden rounded-control border-2 border-transparent aria-pressed:border-brand-primary"
              >
                <AnimalPhoto src={url} alt="" name={animal.name} className="size-20" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold text-text">{title}</h2>
      {children}
    </section>
  );
}
