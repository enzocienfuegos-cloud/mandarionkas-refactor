// apps/web/vite.config.ts
import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spa404Plugin } from '../../packages/vite-plugins/spa-404';

export default defineConfig({
  plugins: [react(), spa404Plugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false, // Set to 'hidden' if uploading maps to an error tracking service
  },
});
