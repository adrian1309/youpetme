import { defineConfig, devices } from '@playwright/test';

import { API_ENV, API_READY_URL, API_URL, WEB_ORIGIN } from './support/env.ts';

const isCI = Boolean(process.env.CI);

/** Building the app, or pulling the PostgreSQL image on a cold machine, takes a while. */
const SERVER_START_TIMEOUT_MS = 120_000;

const chromium = { name: 'chromium', use: devices['Desktop Chrome'] };
const webkit = { name: 'webkit', use: devices['Desktop Safari'] };

export default defineConfig({
  testDir: '.',
  testMatch: '**/*.e2e-spec.ts',
  // Every test creates its own data, so none may depend on another one or on their order.
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Argon2id is CPU-heavy and the API runs on the same runner as the browsers.
  workers: isCI ? 2 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: WEB_ORIGIN, trace: 'retain-on-failure' },
  // Locally Chromium is enough for a fast loop; CI also covers Safari's engine.
  projects: isCI ? [chromium, webkit] : [chromium],
  globalTeardown: './support/global-teardown.ts',
  // Never reuse a running server: `pnpm dev` talks to the development database (ARCH-002).
  // The web app goes first so a busy port fails before Docker is touched.
  webServer: [
    {
      command: 'pnpm exec vite build && pnpm exec vite preview --port 5173 --strictPort',
      cwd: '..',
      env: { VITE_API_URL: API_URL },
      url: WEB_ORIGIN,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
    },
    {
      command: 'node e2e/support/start-api.ts',
      cwd: '..',
      env: API_ENV,
      url: API_READY_URL,
      reuseExistingServer: false,
      timeout: SERVER_START_TIMEOUT_MS,
      stdout: 'pipe',
    },
  ],
});
