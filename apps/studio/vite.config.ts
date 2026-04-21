/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

function normalizePublicBasePath(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed || trimmed === '/') return '/';

  const withoutLeadingSlash = trimmed.replace(/^\/+/, '');
  const withTrailingSlash = withoutLeadingSlash.endsWith('/')
    ? withoutLeadingSlash
    : `${withoutLeadingSlash}/`;

  return `/${withTrailingSlash}`;
}

export default defineConfig(({ command }) => ({
  // Production defaults to root because the editor is intended to live on its
  // own host (for example studio-staging.duskplatform.co). Path prefixes remain
  // opt-in through VITE_PUBLIC_BASE_PATH for temporary compatibility modes.
  base: command === 'serve'
    ? '/'
    : normalizePublicBasePath(process.env.VITE_PUBLIC_BASE_PATH ?? '/'),
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
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;

          if (id.includes('/react/') || id.includes('/react-dom/') || id.includes('/use-sync-external-store/')) {
            return 'react-vendor';
          }

          if (id.includes('/leaflet/')) {
            return 'map-vendor';
          }

          if (id.includes('/video.js/')) {
            return 'video-vendor';
          }

          if (id.includes('/xlsx/')) {
            return 'spreadsheet-vendor';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'node',
    setupFiles:  ['./src/testing/setup.ts'],
    // Vitest automatically loads .env.test — VITE_API_BASE_URL is intentionally
    // empty there so repository tests that assert "throws when base is missing" work.
    envFiles: ['.env.test'],
  },
}));
