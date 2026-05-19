#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const EXPORT_PIPELINE_FUNCTIONS = [
  'buildExportPreflight',
  'buildExportBundle',
  'buildChannelBudgetMeasurement',
  'buildZipFromBundle',
];
const ALLOWED_PREFIXES = [
  'src/export/',
  'src/app/shell/topbar/studio-publication.ts',
];

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full));
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
  return files;
}

const files = collectFiles(SRC_ROOT)
  .map((file) => relative(ROOT, file))
  .filter((file) => !file.includes('/testing/'));

const offenders = [];

for (const file of files) {
  if (ALLOWED_PREFIXES.some((prefix) => file.startsWith(prefix))) continue;
  const content = readFileSync(join(ROOT, file), 'utf8');
  for (const fn of EXPORT_PIPELINE_FUNCTIONS) {
    const memoPattern = new RegExp(`useMemo\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*${fn}\\s*\\(`);
    if (memoPattern.test(content)) {
      offenders.push({ file, fn, reason: `${fn} inside useMemo - runs sync on every state change` });
    }

    const directPattern = new RegExp(`^\\s{0,4}const\\s+\\w+\\s*=\\s*${fn}\\s*\\(`, 'gm');
    for (const match of content.matchAll(directPattern)) {
      const context = content.substring(Math.max(0, (match.index ?? 0) - 200), match.index ?? 0);
      const insideAsync = /async\s+(?:function|\([^)]*\)\s*=>)/.test(context) || /onClick\s*=\s*\{/.test(context);
      if (!insideAsync) {
        offenders.push({ file, fn, reason: `${fn} called in render body - runs on every render` });
      }
    }
  }
}

if (offenders.length) {
  console.error('❌ Export pipeline used in render path:');
  offenders.forEach(({ file, fn, reason }) => {
    console.error(`  - ${file} :: ${fn} :: ${reason}`);
  });
  console.error('');
  console.error('Move export pipeline work to explicit async handlers or export modules.');
  process.exit(1);
}

console.log('✅ Export pipeline is not called in render paths.');
