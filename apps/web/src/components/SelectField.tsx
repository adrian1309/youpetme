import type { ComponentProps } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';

interface SelectFieldProps extends Omit<ComponentProps<'select'>, 'id'> {
  id?: string;
  label: string;
  options: readonly { value: string; label: string }[];
  /** Already-translated error text; the field is marked invalid when present. */
  error?: string;
}

/** Native select with a persistent label and its error wired for assistive technology. */
export function SelectField({ id, label, options, error, className, ...props }: SelectFieldProps) {
  const ids = useFieldIds(id);
  return (
    <div>
      <label htmlFor={ids.inputId} className="mb-1 block text-base font-medium text-text">
        {label}
      </label>
      <select
        {...props}
        id={ids.inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { error })}
        className={`block min-h-11 w-full rounded-control border bg-surface px-3 py-2 text-base text-text ${
          error ? 'border-2 border-feedback-error' : 'border-border-input'
        } ${className ?? ''}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <FieldMessages ids={ids} error={error} />
    </div>
  );
}
