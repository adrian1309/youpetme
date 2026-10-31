import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import config from '../../vite.config';

const envExample = readFileSync(resolve(__dirname, '../../../../.env.example'), 'utf8');

function exampleValue(name: string): string | undefined {
  return new RegExp(`^${name}=(.*)$`, 'm').exec(envExample)?.[1]?.trim();
}

describe('development server (TS-IAM-001: CORS, Origin guard and SameSite=Strict)', () => {
  it('always runs on the port of WEB_ORIGIN, or the API would reject the Origin with 403', () => {
    const webOrigin = new URL(exampleValue('WEB_ORIGIN')!);

    expect(config.server?.port).toBe(Number(webOrigin.port));
    expect(config.server?.strictPort).toBe(true);
  });

  it('reads VITE_API_URL from the repository-root .env, the single source (ARCH-001)', () => {
    expect(
      resolve(__dirname, '../../', typeof config.envDir === 'string' ? config.envDir : '.'),
    ).toBe(resolve(__dirname, '../../../..'));
  });

  it('documents VITE_API_URL pointing at the API port, and nothing secret under the VITE_ prefix', () => {
    const apiPort = exampleValue('API_PORT');

    expect(exampleValue('VITE_API_URL')).toBe(`http://localhost:${apiPort}`);
    const viteVariables = [...envExample.matchAll(/^(VITE_[A-Z_]+)=/gm)].map((match) => match[1]);
    expect(viteVariables).toEqual(['VITE_API_URL']);
  });
});
