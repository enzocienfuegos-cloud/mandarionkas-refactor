#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const EXPORT_PIPELINE_FUNCTIONS = [
  'buildExportPreflight',
  'buildExportBundle',
  'buildExportReadiness',
  'buildExportHandoff',
  'buildDiagnosticSummary',
  'validateExport',
  'buildChannelBudgetMeasurement',
  'buildZipFromBundle',
];
const ALLOWED_PREFIXES = [
  'src/export/',
  'src/domain/document/diagnostics.ts',
  'src/domain/document/export-validation.ts',
  'src/app/shell/topbar/studio-publication.ts',
];
const ALLOWED_RENDER_CASES = [
  { file: 'src/app/shell/topbar/use-export-readiness-controller.ts', fn: 'validateExport' },
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
    const isAllowedRenderCase = ALLOWED_RENDER_CASES.some((entry) => entry.file === file && entry.fn === fn);
    if (isAllowedRenderCase) continue;
    const memoPattern = new RegExp(`useMemo\\s*\\(\\s*\\(\\s*\\)\\s*=>\\s*${fn}\\s*\\(`);
    if (memoPattern.test(content)) {
      offenders.push({ file, fn, reason: `${fn} inside useMemo - still runs on every state change unless gated by mount/deps` });
    }

    const directPattern = new RegExp(`^\\s{0,6}const\\s+\\w+\\s*=\\s*${fn}\\s*\\(`, 'gm');
    for (const match of content.matchAll(directPattern)) {
      const context = content.substring(Math.max(0, (match.index ?? 0) - 200), match.index ?? 0);
      const insideAsync = /async\s+(?:function|\([^)]*\)\s*=>)/.test(context)
        || /onClick\s*=\s*\{/.test(context)
        || /function\s+handle\w+/.test(context);
      if (!insideAsync) {
        offenders.push({ file, fn, reason: `${fn} called in render body - runs on every render` });
      }
    }

    const objectKeyPattern = new RegExp(`\\b\\w+\\s*:\\s*${fn}\\s*\\(`, 'g');
    for (const match of content.matchAll(objectKeyPattern)) {
      const context = content.substring(Math.max(0, (match.index ?? 0) - 400), match.index ?? 0);
      const insideHookReturn = /export\s+function\s+use\w+[\s\S]*?return\s*\{[^}]*$/.test(context)
        || /function\s+use\w+[\s\S]*?return\s*\{[^}]*$/.test(context);
      if (insideHookReturn) {
        offenders.push({ file, fn, reason: `${fn} as eager object-literal value in hook return - use a lazy getter or callback.` });
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
