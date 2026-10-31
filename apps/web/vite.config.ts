import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // @youpetme/contracts is a CommonJS workspace package: pre-bundle it so the dev server serves
  // it as ESM (the production build and Vitest already handle it).
  optimizeDeps: { include: ['@youpetme/contracts'] },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.spec.{ts,tsx}'],
  },
});
