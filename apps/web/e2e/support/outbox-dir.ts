import { mkdirSync, rmSync } from 'node:fs';

import { EMAIL_OUTBOX_DIR } from './env.ts';

/**
 * Lifecycle of the folder the API writes emails to (EMAIL_DELIVERY=file). Kept free of
 * @playwright/test, since start-api.ts runs as a plain Node script.
 */

/** Starts a run with an empty outbox, so no email of an earlier run can be picked up. */
export function resetOutbox(): void {
  rmSync(EMAIL_OUTBOX_DIR, { recursive: true, force: true });
  mkdirSync(EMAIL_OUTBOX_DIR, { recursive: true });
}

export function removeOutbox(): void {
  rmSync(EMAIL_OUTBOX_DIR, { recursive: true, force: true });
}
