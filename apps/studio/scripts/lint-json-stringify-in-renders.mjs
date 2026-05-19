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
const HOT_PATH_CLONE_PREFIXES = [
  'src/core/history/',
  'src/core/store/',
  'src/persistence/',
  'src/canvas/',
  'src/hooks/',
  'src/motion/',
];
const HOT_PATH_CLONE_ALLOWED_FILES = new Set([
  // Reducer-safe utility used outside the dispatch hot path.
  'src/core/store/store-utils.ts',
  // Clipboard and scene duplication are explicit user actions, not per-frame loops.
  'src/canvas/stage/widget-clipboard.ts',
  'src/core/store/reducers/document-scene-reducer.ts',
  'src/core/store/reducers/widgets/widget-create-update-reducer.ts',
]);

function stripCommentsForHotPathChecks(content) {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
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

  if (!HOT_PATH_CLONE_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  if (HOT_PATH_CLONE_ALLOWED_FILES.has(file)) continue;

  const codeOnly = stripCommentsForHotPathChecks(content);
  if (/\bstructuredClone\s*\(/.test(codeOnly)) {
    offenders.push({
      file,
      reason: 'structuredClone in a Studio hot path — clones the full object graph and blocks the main thread',
    });
  }
  if (/JSON\.parse\s*\(\s*JSON\.stringify\s*\(/.test(codeOnly)) {
    offenders.push({
      file,
      reason: 'JSON.parse(JSON.stringify(...)) deep clone in a Studio hot path — use immutable refs or targeted copies instead',
    });
  }
}

if (offenders.length) {
  console.error('❌ Expensive state serialization or cloning detected.');
  console.error('   JSON.stringify, structuredClone, and JSON deep-clone idioms walk the full object graph.');
  console.error('   In selectors, render paths, history, or store hot paths they dominate the main thread.');
  console.error('   Prefer immutable reference comparison, targeted structural helpers, or boundary-only serialization.');
  offenders.forEach(({ file, reason }) => console.error(`  - ${file}: ${reason}`));
  process.exit(1);
}

console.log('✅ No expensive state serialization or cloning in Studio hot paths.');
