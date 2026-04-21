/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  base: '/',
  plugins: [react()],
  resolve: {
    alias: {
      // Resolve workspace packages directly from source
      '@smx/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@smx/vast':      path.resolve(__dirname, '../../packages/vast/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
      // All /v1 calls → platform API (shared Fastify backend)
      '/v1': {
        target:       'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    setupFiles:  ['./src/testing/setup.ts'],
    // Vitest automatically loads .env.test — VITE_API_BASE_URL is intentionally
    // empty there so repository tests that assert "throws when base is missing" work.
    envFiles: ['.env.test'],
  },
});
