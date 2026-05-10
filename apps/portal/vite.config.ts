// apps/portal/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { spa404Plugin } from '../../packages/vite-plugins/spa-404';

export default defineConfig({
  plugins: [react(), spa404Plugin()],
  server: {
    port: 5175,
    proxy: {
      '/v1': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
