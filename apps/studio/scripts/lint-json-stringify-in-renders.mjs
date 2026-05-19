#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const ALLOWED_PREFIXES = [
  'src/platform/api',
  'src/export/',
  'src/repositories/',
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
const stringifyFunctions = new Map();
for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (!/\bJSON\.stringify\s*\(/.test(content)) continue;

  const exportedFunctionPattern = /export\s+function\s+(\w+)\s*\([^)]*\)\s*[^{]*\{([\s\S]*?)\n\}/g;
  for (const match of content.matchAll(exportedFunctionPattern)) {
    const functionName = match[1];
    const body = match[2];
    if (/\bJSON\.stringify\s*\(/.test(body)) {
      stringifyFunctions.set(functionName, file);
    }
  }

  if (/useMemo\s*\(\s*\(\s*\)\s*=>\s*\(?\s*JSON\.stringify/s.test(content)) {
    offenders.push({ file, reason: 'JSON.stringify inside useMemo — expensive in React render hot path' });
  }

  if (/use(?:StudioStore|StudioStoreRef)\s*\([\s\S]{0,300}?JSON\.stringify\s*\(/.test(content)) {
    offenders.push({ file, reason: 'JSON.stringify inside a store selector — runs on every dispatch' });
  }
}

for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  for (const [functionName, sourceFile] of stringifyFunctions.entries()) {
    const selectorPattern = new RegExp(`use(?:StudioStore|StudioStoreRef)\\s*\\(\\s*${functionName}\\b`);
    if (selectorPattern.test(content)) {
      offenders.push({
        file,
        reason: `selector uses "${functionName}" from ${sourceFile}, which internally calls JSON.stringify`,
      });
    }
  }
}

if (offenders.length) {
  console.error('❌ Expensive JSON.stringify usage detected.');
  console.error('   JSON.stringify is O(n) over the object graph plus UTF-8 encoding.');
  console.error('   In selectors or render paths it will dominate the main thread.');
  console.error('   Prefer immutable reference comparison or a targeted structural helper.');
  offenders.forEach(({ file, reason }) => console.error(`  - ${file}: ${reason}`));
  process.exit(1);
}

console.log('✅ No expensive JSON.stringify in hot paths.');
