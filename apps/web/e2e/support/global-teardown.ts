import { removePostgres } from './compose.ts';

/** Runs before Playwright stops the web servers; the database and its volume leave no trace. */
export default function globalTeardown(): void {
  removePostgres();
}
