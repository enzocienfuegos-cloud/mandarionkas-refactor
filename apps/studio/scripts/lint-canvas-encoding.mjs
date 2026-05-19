#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');

const ALLOWED_FILES = new Set([
  'src/assets/image-optimization.ts',
  'src/assets/video-optimization.ts',
]);

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      files.push(full);
    }
  }
  return files;
}

const files = collectFiles(SRC_ROOT)
  .map((file) => relative(ROOT, file))
  .filter((file) => !file.includes('/testing/'))
  .filter((file) => !file.endsWith('runtime-bundle.generated.ts'))
  .filter((file) => !file.includes('/__generated__/'))
  .filter((file) => !ALLOWED_FILES.has(file));

const offenders = [];
for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (/\.toDataURL\s*\(/.test(content)) {
    offenders.push({
      file,
      reason: 'canvas.toDataURL is expensive and synchronous; use a DOM or CSS canvas path instead',
    });
  }
}

if (offenders.length) {
  console.error('❌ canvas.toDataURL detected in production code.');
  console.error('   Sync PNG/JPEG encoding blocks the main thread for tens of milliseconds.');
  console.error('   For scratch and mask UIs, render from a DOM/canvas source directly instead of encoding a data URL.');
  for (const { file, reason } of offenders) {
    console.error(`  - ${file}: ${reason}`);
  }
  process.exit(1);
}

console.log('✅ No canvas.toDataURL in production hot paths.');
