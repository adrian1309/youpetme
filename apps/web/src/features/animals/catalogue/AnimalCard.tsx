import type { AnimalSummary } from '@youpetme/contracts';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { Tag, useAnimalTags } from '../animal-tags';

/** Animal first: the photo and the name lead, the characteristics follow as tags. */
export function AnimalCard({ animal }: { animal: AnimalSummary }) {
  const { t } = useTranslation();
  const tags = useAnimalTags(animal);

  return (
    <li className="flex flex-col overflow-hidden rounded-control border border-border-input bg-surface">
      <img
        src={animal.photoUrl}
        alt={animal.name}
        loading="lazy"
        className="aspect-[4/3] w-full bg-surface-muted object-cover"
      />
      <div className="flex flex-1 flex-col gap-3 p-4">
        <h2 className="text-xl font-bold text-text">{animal.name}</h2>
        <ul className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Tag key={tag}>{tag}</Tag>
          ))}
        </ul>
        <Link
          to={`/animals/${animal.id}`}
          className="mt-auto font-medium text-brand-primary underline"
        >
          {t('animals.catalogue.viewDetail', { name: animal.name })}
        </Link>
      </div>
    </li>
  );
}
