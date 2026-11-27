import type { ComponentProps, ReactNode } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';
import { afterPointerRelease } from './pointer-release';

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
  /** Decorative icon inside the box, at the start (e.g. Mail, Lock); it never replaces the label. */
  startIcon?: ReactNode;
}

/** Text input with its label, hint and error wired for assistive technology (ADR-009). */
export function TextField({
  id,
  label,
  hint,
  hintState,
  error,
  endAdornment,
  startIcon,
  className,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const ids = useFieldIds(id);

  return (
    <div>
      <label htmlFor={ids.inputId} className="mb-1 block text-base font-medium text-text">
        {label}
      </label>
      <div className="relative">
        {startIcon ? (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-text-muted"
          >
            {startIcon}
          </span>
        ) : null}
        <input
          {...inputProps}
          id={ids.inputId}
          // A blur error must not move the control being clicked before the release (SCRUM-51).
          onBlur={onBlur && ((event) => afterPointerRelease(() => onBlur(event)))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(ids, { hint, error })}
          className={`block min-h-11 w-full rounded-control border bg-surface px-3 py-2 text-base text-text focus:border-brand-primary ${
            error ? 'border-2 border-feedback-error' : 'border-border-input'
          } ${startIcon ? 'pl-10' : ''} ${endAdornment ? 'pr-12' : ''} ${className ?? ''}`}
        />
        {endAdornment ? (
          <div className="absolute inset-y-0 right-0 flex items-center pr-1.5">{endAdornment}</div>
        ) : null}
      </div>
      <FieldMessages ids={ids} hint={hint} hintState={hintState} error={error} />
    </div>
  );
}
