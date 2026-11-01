import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { POSTGRES_ENV } from './env.ts';

/** Keeps containers and volumes apart from the development stack (`youpetme`). */
const PROJECT = 'youpetme-e2e';
const COMPOSE_FILE = fileURLToPath(
  new URL('../../../../infra/docker/compose.yaml', import.meta.url),
);

/** The only way to call Compose here, so `down -v` can never reach the development volume. */
function compose(...args: string[]): void {
  execFileSync('docker', ['compose', '-p', PROJECT, '-f', COMPOSE_FILE, ...args], {
    env: { ...process.env, ...POSTGRES_ENV },
    stdio: 'inherit',
  });
}

export function startPostgres(): void {
  compose('up', '-d', '--wait', 'postgres');
}

export function removePostgres(): void {
  compose('down', '-v', '--remove-orphans');
}
