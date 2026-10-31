import type { ComponentProps, ReactNode } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';

interface CheckboxFieldProps extends Omit<ComponentProps<'input'>, 'id' | 'type'> {
  id?: string;
  /** Label content; may contain links (e.g. to the Terms of Service). */
  label: ReactNode;
  error?: string;
}

/** Native checkbox: keyboard, focus and screen-reader behaviour come from the platform. */
export function CheckboxField({ id, label, error, className, ...inputProps }: CheckboxFieldProps) {
  const ids = useFieldIds(id);

  return (
    <div>
      <div className="flex items-start gap-3">
        <input
          {...inputProps}
          type="checkbox"
          id={ids.inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { error })}
          className={`mt-0.5 size-6 shrink-0 accent-brand-primary ${className ?? ''}`}
        />
        <label htmlFor={ids.inputId} className="text-base text-text">
          {label}
        </label>
      </div>
      <FieldMessages ids={ids} error={error} />
    </div>
  );
}
