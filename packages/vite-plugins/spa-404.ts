// packages/vite-plugins/spa-404.ts
//
// Generates a `404.html` in the build output directory that is an exact copy
// of `index.html`. Required for SPA routing on hosts that serve static files
// from an object store (DigitalOcean Spaces, S3, Cloudflare Pages, etc.).
//
// Without this file, any hard navigation to a client-side route like /overview
// gets a real 404 from the object store before React Router can intercept it.
//
// Usage in vite.config.ts:
//   import { spa404Plugin } from '../../packages/vite-plugins/spa-404';
//   plugins: [react(), spa404Plugin()]

import { copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export function spa404Plugin(outDir = 'dist'): Plugin {
  return {
    name: 'smx-spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dir  = resolve(process.cwd(), outDir);
      const src  = resolve(dir, 'index.html');
      const dest = resolve(dir, '404.html');
      copyFileSync(src, dest);
      console.log(`\n✓ SPA fallback: 404.html written to ${outDir}/`);
    },
  };
}
