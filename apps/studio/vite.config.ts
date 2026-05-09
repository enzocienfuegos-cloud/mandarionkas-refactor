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

function matchesNodeModule(id: string, segment: string): boolean {
  return id.includes(`/node_modules/${segment}/`);
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
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/widgets/modules/')) {
            return 'widget-modules';
          }

          if (!id.includes('/node_modules/')) return undefined;

          if (
            matchesNodeModule(id, 'react')
            || matchesNodeModule(id, 'react-dom')
            || matchesNodeModule(id, 'use-sync-external-store')
          ) {
            return 'react-vendor';
          }

          if (matchesNodeModule(id, 'lucide-react')) {
            return 'ui-vendor';
          }

          if (
            matchesNodeModule(id, '@aws-sdk')
            || matchesNodeModule(id, '@smithy')
            || matchesNodeModule(id, '@aws-crypto')
            || matchesNodeModule(id, 'tslib')
          ) {
            return 'storage-vendor';
          }

          if (matchesNodeModule(id, 'leaflet')) {
            return 'map-vendor';
          }

          if (matchesNodeModule(id, 'video.js')) {
            return 'video-core';
          }

          if (
            matchesNodeModule(id, '@videojs')
            || matchesNodeModule(id, 'mux.js')
            || matchesNodeModule(id, 'm3u8-parser')
            || matchesNodeModule(id, 'mpd-parser')
            || matchesNodeModule(id, 'aes-decrypter')
            || matchesNodeModule(id, 'global')
            || matchesNodeModule(id, 'url-toolkit')
          ) {
            return 'video-streaming';
          }

          if (matchesNodeModule(id, 'xlsx')) {
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
    exclude: ['tests/visual/**', '**/node_modules/**', '**/dist/**', '**/.{idea,git,cache,output,temp}/**'],
  },
}));
