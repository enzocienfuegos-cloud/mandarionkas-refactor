import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    alias: {
      '@smx/scratch-engine': resolve(__dirname, '../../packages/scratch-engine/src/index.ts'),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/export/runtime/boot.ts'),
      name: 'SmxRuntime',
      formats: ['iife'],
      fileName: () => 'runtime.iife.js',
    },
    outDir: resolve(__dirname, 'src/export/__generated__'),
    rollupOptions: {
      output: {
        extend: true,
        inlineDynamicImports: true,
      },
    },
    minify: 'terser',
    sourcemap: false,
    emptyOutDir: true,
  },
});
