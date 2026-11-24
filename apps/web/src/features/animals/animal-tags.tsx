import type { AnimalSummary } from '@youpetme/contracts';
import { useTranslation } from 'react-i18next';

export const ANIMALS_PATH = '/api/v1/animals';

/** Text tag (Design System — Animal information patterns): the text alone carries the meaning. */
export function Tag({ children }: { children: string }) {
  return (
    <li className="rounded-full border border-border-input bg-surface-muted px-3 py-1 text-sm text-text">
      {children}
    </li>
  );
}

type TagSource = Pick<
  AnimalSummary,
  | 'species'
  | 'size'
  | 'ageGroup'
  | 'temperament'
  | 'compatibleWithChildren'
  | 'compatibleWithOtherAnimals'
>;

/** Card tags: species, size, age, temperament and the known compatibility flags. */
export function useAnimalTags(animal: TagSource): string[] {
  const { t } = useTranslation();
  const flag = (kind: 'children' | 'otherAnimals', value: boolean | null) =>
    value === null ? [] : [t(`animals.compatibility.${kind}.${String(value)}`)];
  return [
    t(`animals.species.${animal.species}`),
    t(`animals.size.${animal.size}`),
    t(`animals.ageGroup.${animal.ageGroup}`),
    ...animal.temperament.map((tag) => t(`animals.temperament.${tag}`)),
    ...flag('children', animal.compatibleWithChildren),
    ...flag('otherAnimals', animal.compatibleWithOtherAnimals),
  ];
}
