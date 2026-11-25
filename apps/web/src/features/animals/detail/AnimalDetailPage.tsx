import { useQuery } from '@tanstack/react-query';
import type { AnimalDetail } from '@youpetme/contracts';
import { useTranslation } from 'react-i18next';
import { Link, useParams } from 'react-router';

import { Alert } from '../../../components/Alert';
import { PageTitle } from '../../../components/PageTitle';
import { useApiClient } from '../../../lib/http/api-client-context';
import { ApiError } from '../../../lib/http/api-error';
import { AdoptionRequestSection } from '../../adoptions/request/AdoptionRequestSection';
import { ANIMALS_PATH, Tag } from '../animal-tags';

/** `/animals/:id`: public detail of an animal, in any status (SCRUM-13). */
export function AnimalDetailPage() {
  const { t } = useTranslation();
  const client = useApiClient();
  const { id = '' } = useParams();

  const query = useQuery({
    queryKey: ['animal', id],
    queryFn: ({ signal }) =>
      client.get<AnimalDetail>(`${ANIMALS_PATH}/${encodeURIComponent(id)}`, { signal }),
  });

  const back = (
    <Link to="/animals" className="font-medium text-brand-primary underline">
      {t('animals.detail.back')}
    </Link>
  );

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
        <div aria-hidden="true" className="h-96 animate-pulse rounded-control bg-surface-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      {content}
      <p>{back}</p>
    </div>
  );
}

function AnimalDetailView({ animal }: { animal: AnimalDetail }) {
  const { t } = useTranslation();
  const characteristics = [
    t(`animals.species.${animal.species}`),
    t(`animals.size.${animal.size}`),
    t(`animals.ageGroup.${animal.ageGroup}`),
  ];
  const compatibility = [
    t(`animals.compatibility.children.${String(animal.compatibleWithChildren)}`),
    t(`animals.compatibility.otherAnimals.${String(animal.compatibleWithOtherAnimals)}`),
  ];

  return (
    <article className="space-y-6">
      <PageTitle title={animal.name} />
      <h1 className="text-3xl font-bold text-text">{animal.name}</h1>

      {animal.status !== 'AVAILABLE' ? (
        <p className="flex gap-2 rounded-control border-2 border-border-input bg-surface-muted p-3 text-base font-semibold text-text">
          <span aria-hidden="true">ⓘ</span>
          <span>
            {t('animals.detail.notAvailable', { status: t(`animals.status.${animal.status}`) })}
          </span>
        </p>
      ) : null}

      <AdoptionRequestSection animal={animal} />

      <ul className="grid gap-4 sm:grid-cols-2">
        {animal.photoUrls.map((url, index) => (
          <li key={url}>
            <img
              src={url}
              alt={t('animals.detail.photo', { index: index + 1, name: animal.name })}
              className="aspect-[4/3] w-full rounded-control bg-surface-muted object-cover"
            />
          </li>
        ))}
      </ul>

      <Section title={t('animals.detail.characteristics')}>
        <ul className="flex flex-wrap gap-2">
          {characteristics.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </ul>
        {animal.breed ? (
          <p className="mt-3 text-base text-text">
            <span className="font-semibold">{t('animals.detail.breed')}: </span>
            {animal.breed}
          </p>
        ) : null}
      </Section>

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
        <ul className="flex flex-wrap gap-2">
          {compatibility.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </ul>
      </Section>

      {animal.careNotes ? (
        <Section title={t('animals.detail.careNotes')}>
          <p className="whitespace-pre-line text-base text-text">{animal.careNotes}</p>
        </Section>
      ) : null}
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xl font-bold text-text">{title}</h2>
      {children}
    </section>
  );
}
