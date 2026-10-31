import type { FieldIds } from './field-ids';

interface FieldMessagesProps {
  ids: FieldIds;
  hint?: string;
  /** `met` and `pending` add a symbol next to the hint; the state is also in the hint's text. */
  hintState?: 'met' | 'pending';
  error?: string;
}

/**
 * The hint and the error of a field. Both are plain paragraphs referenced by aria-describedby
 * (no live region), so they are read when the field gets the focus; colour is never the only cue.
 */
export function FieldMessages({ ids, hint, hintState, error }: FieldMessagesProps) {
  return (
    <>
      {hint ? (
        <p
          id={ids.hintId}
          className={`mt-1 flex gap-2 text-sm ${
            hintState === 'met' ? 'text-feedback-success' : 'text-text-muted'
          }`}
        >
          {hintState ? <span aria-hidden="true">{hintState === 'met' ? '✓' : '○'}</span> : null}
          <span>{hint}</span>
        </p>
      ) : null}
      {error ? (
        <p id={ids.errorId} className="mt-1 flex gap-2 text-sm font-medium text-feedback-error">
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </>
  );
}
