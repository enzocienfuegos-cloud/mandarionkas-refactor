#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const ALLOWED_FILES = new Set([
  'src/core/store/use-studio-store.ts',
]);

const IDENTITY_SELECTOR_PATTERNS = [
  /useStudioStore\s*\(\s*\(\s*value\s*\)\s*=>\s*value\s*\)/,
  /useStudioStore\s*\(\s*\(\s*state\s*\)\s*=>\s*state\s*\)/,
  /useStudioStore\s*\(\s*\(\s*current\s*\)\s*=>\s*current\s*\)/,
  /useStudioStore\s*\(\s*\(\s*snapshot\s*\)\s*=>\s*snapshot\s*\)/,
  /useStudioStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\s*\)/,
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
  .filter((file) => !ALLOWED_FILES.has(file));

const offenders = [];
for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (IDENTITY_SELECTOR_PATTERNS.some((pattern) => pattern.test(content))) {
    offenders.push(file);
  }
}

if (offenders.length) {
  console.error('❌ Broad store subscriptions detected. These re-render the component on every dispatch.');
  console.error('   Replace with useStudioStoreSnapshot() or a narrow selector + shallowEqual.');
  offenders.forEach((file) => console.error(`  - ${file}`));
  process.exit(1);
}

console.log('✅ No broad store subscriptions.');
