#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const HOT_PATH_FUNCTIONS = [
  'getLiveWidgetFrame',
  'getLiveWidgetOpacity',
  'resolveInheritedMotionFrame',
  'resolveInheritedOpacity',
  'sortKeyframes',
  'isWidgetVisibleAt',
  'hasTimelineDynamics',
];
const EXCLUDED_FILES = new Set([
  'src/motion/motion-template-keyframes.ts',
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

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const files = collectFiles(SRC_ROOT)
  .map((file) => relative(ROOT, file))
  .filter((file) => !file.includes('/testing/'));

const offenders = [];

for (const file of files) {
  if (EXCLUDED_FILES.has(file)) continue;
  const content = readFileSync(join(ROOT, file), 'utf8');
  for (const fnName of HOT_PATH_FUNCTIONS) {
    const bodyRegex = new RegExp(
      `(?:export\\s+)?function\\s+${escapeRegExp(fnName)}\\s*\\([^)]*\\)\\s*\\{([\\s\\S]*?)\\n\\}`,
      'g',
    );
    for (const match of content.matchAll(bodyRegex)) {
      const body = match[1];
      if (/\[\.\.\.[a-zA-Z_$]/.test(body)) {
        offenders.push({ file, fn: fnName, reason: 'uses [...spread] in body - allocates new array on every call' });
      }
      if (/\.sort\(/.test(body) && !/getSortedTracks|tracksCache/.test(body)) {
        offenders.push({ file, fn: fnName, reason: 'calls .sort() in body - should pre-sort and cache' });
      }
      if (/\.filter\(/.test(body)) {
        offenders.push({ file, fn: fnName, reason: 'calls .filter() in body - allocates new array' });
      }
    }
  }
}

if (offenders.length) {
  console.error('❌ Hot path function with allocation:');
  offenders.forEach(({ file, fn, reason }) => {
    console.error(`  - ${file} :: ${fn} :: ${reason}`);
  });
  process.exit(1);
}

console.log('✅ Hot path functions are allocation-free.');
