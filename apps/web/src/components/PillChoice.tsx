import { Check } from 'lucide-react';
import type { ComponentProps, ReactNode } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';

/**
 * A group of pill choices (Design System — Pill choices, SCRUM-56): fieldset + legend with its
 * icon, the pills and an optional error the group points to.
 */
export function PillFieldset({
  legend,
  icon,
  error,
  children,
}: {
  legend: string;
  icon?: ReactNode;
  error?: string;
  children: ReactNode;
}) {
  const ids = useFieldIds();
  return (
    <fieldset aria-describedby={describedBy(ids, { error })}>
      <legend className="mb-2 flex items-center gap-2 text-base font-semibold text-text">
        {icon}
        {legend}
      </legend>
      <div className="flex flex-wrap gap-2">{children}</div>
      <FieldMessages ids={ids} error={error} />
    </fieldset>
  );
}

type PillOptionProps = Omit<ComponentProps<'input'>, 'className' | 'children'> & {
  label: string;
  /** Decorative icon shown while not selected; selected pills show a check instead. */
  icon?: ReactNode;
};

/**
 * One radio or checkbox drawn as a pill. The real input stays (visually hidden) so the keyboard,
 * the role and react-hook-form keep working; the look follows its state with CSS only, so it works
 * for controlled and uncontrolled inputs alike. The check mark tells the choice apart without
 * relying on colour.
 */
export function PillOption({ label, icon, ...input }: PillOptionProps) {
  return (
    <label className="group inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-pill border-2 border-border-input bg-surface px-4 text-base font-medium text-text hover:border-brand-primary has-checked:border-brand-primary has-checked:bg-brand-primary has-checked:text-on-brand has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-brand-primary has-[[aria-invalid=true]]:border-feedback-error">
      <input {...input} className="sr-only" />
      <Check aria-hidden="true" className="hidden size-4 group-has-checked:block" />
      {icon ? <span className="contents group-has-checked:hidden">{icon}</span> : null}
      {label}
    </label>
  );
}
