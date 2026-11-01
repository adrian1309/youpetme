import { execFileSync, spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { removePostgres, startPostgres } from './compose.ts';
import { API_ENV } from './env.ts';

/**
 * Playwright's second webServer: a fresh database with the committed migrations, then the built
 * API. Playwright only registers globalTeardown once every webServer is up, so a failure here
 * has to clean up after itself.
 */
const API_DIR = fileURLToPath(new URL('../../../api/', import.meta.url));
const env = { ...process.env, ...API_ENV };

function removePostgresQuietly(): void {
  try {
    removePostgres();
  } catch (error) {
    console.error('Could not remove the E2E database:', error);
  }
}

try {
  // A forcibly killed run may have left its database behind.
  removePostgres();
  startPostgres();
  execFileSync(
    process.execPath,
    [join(API_DIR, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'],
    { cwd: API_DIR, env, stdio: 'inherit' },
  );
} catch (error) {
  console.error('Could not prepare the E2E database:', error);
  removePostgresQuietly();
  process.exit(1);
}

spawn(process.execPath, ['dist/main.js'], { cwd: API_DIR, env, stdio: 'inherit' }).on(
  'exit',
  (code) => {
    removePostgresQuietly();
    process.exit(code ?? 1);
  },
);
