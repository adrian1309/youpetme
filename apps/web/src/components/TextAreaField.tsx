import type { ComponentProps } from 'react';

import { describedBy, useFieldIds } from './field-ids';
import { FieldMessages } from './FieldMessages';

interface TextAreaFieldProps extends Omit<ComponentProps<'textarea'>, 'id'> {
  label: string;
  hint?: string;
  error?: string;
}

/** Multi-line text field with a visible label, an optional hint and an error (Design System). */
export function TextAreaField({ label, hint, error, ...props }: TextAreaFieldProps) {
  const ids = useFieldIds();
  return (
    <div>
      <label htmlFor={ids.inputId} className="mb-1 block text-base font-medium text-text">
        {label}
      </label>
      <textarea
        rows={4}
        {...props}
        id={ids.inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(ids, { hint, error })}
        className={`block w-full rounded-control border bg-surface px-3 py-2 text-base text-text ${
          error ? 'border-2 border-feedback-error' : 'border-border-input'
        }`}
      />
      <FieldMessages ids={ids} hint={hint} error={error} />
    </div>
  );
}
