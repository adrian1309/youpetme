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

/**
 * Runs SQL inside the E2E database container and returns its unaligned output. `variables` become
 * psql variables (`:'name'` in the SQL), so values are quoted by psql and never concatenated.
 */
export function psql(sql: string, variables: Record<string, string> = {}): string {
  const variableArgs = Object.entries(variables).flatMap(([name, value]) => [
    '-v',
    `${name}=${value}`,
  ]);
  const { POSTGRES_USER, POSTGRES_DB } = POSTGRES_ENV;
  return execFileSync(
    'docker',
    [
      'compose',
      '-p',
      PROJECT,
      '-f',
      COMPOSE_FILE,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-U',
      POSTGRES_USER,
      '-d',
      POSTGRES_DB,
      ...variableArgs,
      '-f',
      '-',
    ],
    { env: { ...process.env, ...POSTGRES_ENV }, input: sql, encoding: 'utf8' },
  );
}

export function startPostgres(): void {
  compose('up', '-d', '--wait', 'postgres');
}

export function removePostgres(): void {
  compose('down', '-v', '--remove-orphans');
}
