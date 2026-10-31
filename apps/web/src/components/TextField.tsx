import type { ComponentProps, ReactNode } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';

export interface TextFieldProps extends Omit<ComponentProps<'input'>, 'id'> {
  id?: string;
  /** Persistent, visible label (never replaced by a placeholder). */
  label: string;
  hint?: string;
  hintState?: 'met' | 'pending';
  /** Already-translated error text; the field is marked invalid when present. */
  error?: string;
  /** Control placed inside the input's box, at the end (e.g. the show/hide password toggle). */
  endAdornment?: ReactNode;
}

/** Text input with its label, hint and error wired for assistive technology (ADR-009). */
export function TextField({
  id,
  label,
  hint,
  hintState,
  error,
  endAdornment,
  className,
  ...inputProps
}: TextFieldProps) {
  const ids = useFieldIds(id);

  return (
    <div>
      <label htmlFor={ids.inputId} className="mb-1 block text-base font-medium text-text">
        {label}
      </label>
      <div className="relative">
        <input
          {...inputProps}
          id={ids.inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { hint, error })}
          className={`block min-h-11 w-full rounded-control border bg-surface px-3 py-2 text-base text-text ${
            error ? 'border-2 border-feedback-error' : 'border-border-input'
          } ${endAdornment ? 'pr-14' : ''} ${className ?? ''}`}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1">{endAdornment}</div>
        ) : null}
      </div>
      <FieldMessages ids={ids} hint={hint} hintState={hintState} error={error} />
    </div>
  );
}
