#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const ALLOWED_PREFIXES = [
  'src/platform/',
  'src/persistence/',
  'src/export/',
  'src/assets/storage-api.ts',
];

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

const files = collectFiles(SRC_ROOT)
  .map((fullPath) => relative(ROOT, fullPath))
  .filter((file) => !file.includes('/testing/'))
  .filter((file) => !file.endsWith('runtime-bundle.generated.ts'))
  .filter((file) => !file.includes('/__generated__/'))
  .filter((file) => !ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix)));

const offenders = [];
for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (!/\bJSON\.stringify\s*\(/.test(content)) continue;
  const stringifyInMemo = /useMemo\s*\(\s*\(\s*\)\s*=>\s*\(?\s*JSON\.stringify/s.test(content);
  if (!stringifyInMemo) continue;
  offenders.push({ file, reason: 'JSON.stringify inside useMemo — expensive in React render hot path' });
}

if (offenders.length) {
  console.error('❌ JSON.stringify inside React render detected.');
  console.error('   Replace it with a cheap signature built from stable identifiers.');
  offenders.forEach(({ file, reason }) => console.error(`  - ${file}: ${reason}`));
  process.exit(1);
}

console.log('✅ No JSON.stringify in React render hot paths.');
