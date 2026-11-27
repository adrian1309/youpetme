import type { AnimalSummary } from '@youpetme/contracts';
import { ArrowRight, Baby, PawPrint } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';

import { AnimalPhoto } from '../../../components/AnimalPhoto';
import { secondaryButtonClass } from '../../../components/button-styles';
import { AgeIcon, CompatibilityIcon, SizeIcon, SpeciesIcon, Tag } from '../animal-tags';

/** At most this many temperament tags on a card; the detail shows them all. */
const CARD_TEMPERAMENT_TAGS = 2;

/**
 * Animal first (Design System — Animal card): the photo and the name lead. The whole card is one
 * stretched link named after the animal; "Conócelo" only looks like a button. `children` adds
 * content below the tags (AI Matching: the fit and its reasons).
 */
export function AnimalCard({
  animal,
  children,
  headingLevel = 2,
}: {
  animal: AnimalSummary;
  children?: ReactNode;
  /** 3 when the cards sit under a section heading (home page). */
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const { t } = useTranslation();
  const species = t(`animals.species.${animal.species}`);
  // Unknown compatibility is left out of cards so it is never read as "no" (Design System).
  const compatibility = [
    { kind: 'children', value: animal.compatibleWithChildren, Icon: Baby },
    { kind: 'otherAnimals', value: animal.compatibleWithOtherAnimals, Icon: PawPrint },
  ].filter((item) => item.value !== null);

  return (
    <li className="group relative flex flex-col overflow-hidden rounded-card border border-border-subtle bg-surface shadow-soft">
      <div className="relative overflow-hidden">
        <AnimalPhoto
          src={animal.photoUrl}
          alt={animal.name}
          name={animal.name}
          loading="lazy"
          className="aspect-[4/3] w-full motion-safe:transition-transform motion-safe:duration-300 motion-safe:group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-pill bg-surface px-3 py-1 text-sm font-semibold text-text shadow-soft">
          <SpeciesIcon species={animal.species} />
          {species}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <Heading className="text-xl font-semibold text-text">
          <Link to={`/animals/${animal.id}`} className="after:absolute after:inset-0">
            {animal.name}
          </Link>
        </Heading>
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-muted">
          <li className="inline-flex items-center gap-1.5">
            <SizeIcon />
            {t(`animals.size.${animal.size}`)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <AgeIcon />
            {t(`animals.ageGroup.${animal.ageGroup}`)}
          </li>
          {compatibility.map(({ kind, value, Icon }) => {
            const text = t(`animals.compatibility.${kind}.${String(value)}`);
            return (
              <li key={kind} title={text} className="inline-flex items-center gap-0.5 text-text">
                <Icon aria-hidden="true" className="size-4" />
                <CompatibilityIcon value={value} />
                <span className="sr-only">{text}</span>
              </li>
            );
          })}
        </ul>
        {animal.temperament.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {animal.temperament.slice(0, CARD_TEMPERAMENT_TAGS).map((tag) => (
              <Tag key={tag}>{t(`animals.temperament.${tag}`)}</Tag>
            ))}
          </ul>
        ) : null}
        {children}
        <span
          aria-hidden="true"
          className={`${secondaryButtonClass} mt-auto self-start group-hover:bg-accent-soft`}
        >
          {t('animals.catalogue.meet')}
          <ArrowRight className="size-5" />
        </span>
      </div>
    </li>
  );
}
