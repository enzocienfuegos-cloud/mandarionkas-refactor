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

function collectUseStudioStoreCalls(content) {
  const calls = [];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const callStart = content.indexOf('useStudioStore', searchIndex);
    if (callStart === -1) break;
    const openParen = content.indexOf('(', callStart);
    if (openParen === -1) break;

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;
    let closeIndex = -1;

    for (let index = openParen; index < content.length; index += 1) {
      const char = content[index];
      const next = content[index + 1];
      const prev = content[index - 1];

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }

      if (inBlockComment) {
        if (prev === '*' && char === '/') inBlockComment = false;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate) {
        if (char === '/' && next === '/') {
          inLineComment = true;
          index += 1;
          continue;
        }
        if (char === '/' && next === '*') {
          inBlockComment = true;
          index += 1;
          continue;
        }
      }

      if (!inDouble && !inTemplate && char === '\'' && prev !== '\\') {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inTemplate && char === '"' && prev !== '\\') {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && char === '`' && prev !== '\\') {
        inTemplate = !inTemplate;
        continue;
      }

      if (inSingle || inDouble || inTemplate) continue;

      if (char === '(') {
        depth += 1;
        continue;
      }
      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          closeIndex = index;
          break;
        }
      }
    }

    if (closeIndex === -1) break;
    calls.push(content.slice(callStart, closeIndex + 1));
    searchIndex = closeIndex + 1;
  }

  return calls;
}

function returnsObjectLiteral(call) {
  return /useStudioStore\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\(\s*\{/.test(call)
    || /useStudioStore\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\{[\s\S]*?\breturn\s*\{/.test(call);
}

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
    offenders.push({ file, reason: 'identity selector' });
    continue;
  }

  const calls = collectUseStudioStoreCalls(content);
  for (const call of calls) {
    if (returnsObjectLiteral(call) && !call.includes('shallowEqual')) {
      offenders.push({ file, reason: 'object-returning selector without shallowEqual' });
      break;
    }
    if (returnsObjectLiteral(call) && call.includes('shallowEqual') && call.includes('playheadMs')) {
      offenders.push({ file, reason: 'playheadMs coupled inside shallowEqual snapshot' });
      break;
    }
  }
}

if (offenders.length) {
  console.error('❌ Broad store subscription patterns detected.');
  console.error('   Replace with useStudioStoreSnapshot(), narrow selectors, or move playhead reads out of shared snapshots.');
  offenders.forEach(({ file, reason }) => console.error(`  - ${file}: ${reason}`));
  process.exit(1);
}

console.log('✅ No broad store subscription patterns.');
