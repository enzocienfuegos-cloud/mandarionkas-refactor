/// <reference types="vitest/config" />

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { spa404Plugin } from '../../packages/vite-plugins/spa-404';

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
  base: command === 'serve'
    ? '/'
    : normalizePublicBasePath(process.env.VITE_PUBLIC_BASE_PATH ?? '/'),
  plugins: [react(), spa404Plugin()],
  resolve: {
    alias: {
      '@smx/contracts': path.resolve(__dirname, '../../packages/contracts/src/index.ts'),
      '@smx/vast':      path.resolve(__dirname, '../../packages/vast/src/index.ts'),
    },
  },
  server: {
    port: 5174,
    proxy: {
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
    envFiles: ['.env.test'],
  },
}));
