/**
 * vitest setup file (drop at apps/web/vitest.setup.ts).
 *
 * Wire from vitest.config.ts:
 *
 *   import { defineConfig } from 'vitest/config';
 *   import react from '@vitejs/plugin-react';
 *
 *   export default defineConfig({
 *     plugins: [react()],
 *     test: {
 *       environment: 'jsdom',
 *       setupFiles: ['./vitest.setup.ts'],
 *       globals: false,
 *     },
 *     resolve: {
 *       alias: { '@': '/src' },
 *     },
 *   });
 *
 * Required dev deps:
 *   npm i -D vitest @vitejs/plugin-react jsdom \
 *           @testing-library/react @testing-library/jest-dom \
 *           @testing-library/user-event
 */

import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
