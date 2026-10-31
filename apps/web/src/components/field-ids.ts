import { useId } from 'react';

export interface FieldIds {
  inputId: string;
  hintId: string;
  errorId: string;
}

/** Stable, unique ids to tie a control to its hint and error through aria-describedby. */
export function useFieldIds(id?: string): FieldIds {
  const generated = useId();
  const base = id ?? generated;
  return { inputId: base, hintId: `${base}-hint`, errorId: `${base}-error` };
}

/** aria-describedby value: the hint, then the error, only for the parts that are shown. */
export function describedBy(
  ids: FieldIds,
  present: { hint?: string; error?: string },
): string | undefined {
  const parts = [present.hint ? ids.hintId : null, present.error ? ids.errorId : null].filter(
    (part): part is string => part !== null,
  );
  return parts.length > 0 ? parts.join(' ') : undefined;
}
