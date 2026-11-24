import { removePostgres } from './compose.ts';
import { removeOutbox } from './outbox-dir.ts';

/**
 * Runs before Playwright stops the web servers; the database, its volume and the captured emails
 * leave no trace.
 */
export default function globalTeardown(): void {
  removePostgres();
  removeOutbox();
}
