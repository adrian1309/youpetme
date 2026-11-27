import type { AnimalSummary, Species } from '@youpetme/contracts';
import { Cake, Cat, Check, CircleHelp, Dog, PawPrint, Ruler, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

export const ANIMALS_PATH = '/api/v1/animals';

const iconClass = 'size-4 shrink-0';

/** Text tag in a pill (Design System — Animal information patterns): the text carries meaning. */
export function Tag({ children, icon }: { children: string; icon?: ReactNode }) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-pill bg-accent-soft px-3 py-1 text-sm font-medium text-on-accent-soft">
      {icon}
      {children}
    </li>
  );
}

/** Dog, Cat or a paw for any other species; decorative, the species name is always written. */
export function SpeciesIcon({
  species,
  className = iconClass,
}: {
  species: Species;
  className?: string;
}) {
  const Icon = species === 'DOG' ? Dog : species === 'CAT' ? Cat : PawPrint;
  return <Icon aria-hidden="true" className={className} />;
}

export const SizeIcon = () => <Ruler aria-hidden="true" className={iconClass} />;
export const AgeIcon = () => <Cake aria-hidden="true" className={iconClass} />;

/** Check = good with, TriangleAlert = better without, CircleHelp = unknown. Text always follows. */
export function CompatibilityIcon({ value }: { value: boolean | null }) {
  const Icon = value === true ? Check : value === false ? TriangleAlert : CircleHelp;
  return <Icon aria-hidden="true" className={iconClass} />;
}

export type TagSource = Pick<
  AnimalSummary,
  | 'species'
  | 'size'
  | 'ageGroup'
  | 'temperament'
  | 'compatibleWithChildren'
  | 'compatibleWithOtherAnimals'
>;
