import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @youpetme/contracts is a CommonJS workspace package: pre-bundle it so the dev server serves
  // it as ESM (the production build and Vitest already handle it).
  // The repository-root .env is the single source (ARCH-001). Vite only exposes VITE_* variables
  // to the browser, so the API secrets in that file never reach the client.
  envDir: '../..',
  // The API accepts only WEB_ORIGIN as Origin (CORS and the request guard): never fall back to
  // another port silently.
  server: { port: 5173, strictPort: true },
  optimizeDeps: { include: ['@youpetme/contracts'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
