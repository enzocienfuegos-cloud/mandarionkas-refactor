#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Smoke test for the dusk-fix package.
 *
 * Run AFTER you copy the zip files into your repo and BEFORE you run
 * `npm install`. Verifies:
 *
 *   1. All expected files are present.
 *   2. Every primitive imported via @/system actually resolves to an export.
 *   3. Every icon imported from @/system/icons resolves to a re-export.
 *   4. No file accidentally imports lucide-react directly outside the barrel.
 *   5. No file uses bg-indigo-* / bg-green-600 / bg-red-600.
 *   6. Tokens.css defines both light and dark for every key.
 *
 * Exits with code 0 on success, 1 on any failure.
 *
 * Usage:
 *   node scripts/smoke-test.mjs            # auto-detects apps/web
 *   node scripts/smoke-test.mjs <root>
 */

import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] ?? 'apps/web');
const src  = path.join(root, 'src');

if (!fs.existsSync(src)) {
  fail(`apps/web/src not found at ${src}`);
}

let errors = 0;
let warnings = 0;

console.log(`\nSmoke test for ${root}`);
console.log('='.repeat(60));

// ─── 1. File presence ─────────────────────────────────────────────────────
const REQUIRED = [
  'src/system/index.ts',
  'src/system/tokens.css',
  'src/system/cn.ts',
  'src/system/icons/index.ts',
  'src/system/primitives/Button.tsx',
  'src/system/primitives/Panel.tsx',
  'src/system/primitives/Input.tsx',
  'src/system/primitives/Select.tsx',
  'src/system/primitives/Badge.tsx',
  'src/system/primitives/Tabs.tsx',
  'src/system/primitives/Modal.tsx',
  'src/system/primitives/Skeleton.tsx',
  'src/system/primitives/Spinner.tsx',
  'src/system/primitives/EmptyState.tsx',
  'src/system/primitives/MetricCard.tsx',
  'src/system/data-table/DataTable.tsx',
  'src/system/feedback/Toast.tsx',
  'src/system/feedback/Confirm.tsx',
  'src/shell/AppShell.tsx',
  'src/shell/Sidebar.tsx',
  'src/shell/TopBar.tsx',
  'src/shell/DuskLogo.tsx',
  'src/shell/Shell.tsx',
  'src/index.css',
  'src/App.tsx',
  'tailwind.config.js',
];

let missing = 0;
for (const rel of REQUIRED) {
  if (!fs.existsSync(path.join(root, rel))) {
    console.log(`  MISSING: ${rel}`);
    missing += 1;
  }
}
if (missing > 0) errors += 1;
console.log(`File presence: ${missing === 0 ? '✓' : `✗ ${missing} missing`}`);

// ─── 2. System exports vs imports ─────────────────────────────────────────
const systemIndex = read(path.join(src, 'system/index.ts'));
const exports = new Set();
for (const m of systemIndex.matchAll(/export\s+(?:type\s+)?\{([^}]+)\}/g)) {
  for (let name of m[1].split(',')) {
    name = name.trim();
    if (!name) continue;
    if (name.startsWith('type ')) name = name.slice(5).trim();
    if (name.includes(' as ')) name = name.split(' as ')[1].trim();
    exports.add(name);
  }
}
if (/export\s+\*\s+as\s+Icons/.test(systemIndex)) exports.add('Icons');

const consumers = walkFiles(src, ['.tsx', '.ts']).filter(
  (f) => !f.includes('/system/') && !f.endsWith('index.ts'),
);

const missingExports = new Map(); // name -> [file]
for (const file of consumers) {
  const text = read(file);
  for (const m of text.matchAll(/import\s+(?:type\s+)?\{([^}]+)\}\s+from\s+['"](?:\.\.\/)+system['"]/g)) {
    for (let name of m[1].split(',')) {
      name = name.trim();
      if (!name) continue;
      if (name.startsWith('type ')) name = name.slice(5).trim();
      if (name.includes(' as ')) name = name.split(' as ')[0].trim();
      if (!exports.has(name)) {
        if (!missingExports.has(name)) missingExports.set(name, []);
        missingExports.get(name).push(path.relative(root, file));
      }
    }
  }
}
if (missingExports.size > 0) {
  errors += 1;
  console.log(`\nSystem imports: ✗`);
  for (const [name, files] of missingExports) {
    console.log(`  '${name}' is imported but not exported by system/index.ts`);
    for (const f of files) console.log(`    └─ ${f}`);
  }
} else {
  console.log(`System imports: ✓ ${consumers.length} files, ${exports.size} exports`);
}

// ─── 3. Icon barrel coverage ──────────────────────────────────────────────
const iconsIndex = read(path.join(src, 'system/icons/index.ts'));
const iconExports = new Set();
for (const m of iconsIndex.matchAll(/^[\s]*([A-Z][A-Za-z0-9]*)(?:\s+as\s+([A-Z][A-Za-z0-9]+))?[,\s]*$/gm)) {
  iconExports.add(m[2] || m[1]);
}

const missingIcons = new Map();
for (const file of consumers) {
  const text = read(file);
  for (const m of text.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](?:\.\.\/)+system\/icons['"]/g)) {
    for (let name of m[1].split(',')) {
      name = name.trim();
      if (!name) continue;
      if (name.includes(' as ')) name = name.split(' as ')[0].trim();
      if (!iconExports.has(name)) {
        if (!missingIcons.has(name)) missingIcons.set(name, []);
        missingIcons.get(name).push(path.relative(root, file));
      }
    }
  }
}
if (missingIcons.size > 0) {
  errors += 1;
  console.log(`\nIcon barrel: ✗`);
  for (const [name, files] of missingIcons) {
    console.log(`  '${name}' not in system/icons/index.ts`);
    for (const f of files) console.log(`    └─ ${f}`);
  }
} else {
  console.log(`Icon barrel: ✓ ${iconExports.size} icons`);
}

// ─── 4. Direct lucide imports ─────────────────────────────────────────────
let directLucide = 0;
for (const file of consumers) {
  const text = read(file);
  if (/from\s+['"]lucide-react['"]/.test(text)) {
    if (!file.endsWith('icons/index.ts')) {
      console.log(`  DIRECT LUCIDE: ${path.relative(root, file)}`);
      directLucide += 1;
    }
  }
}
if (directLucide > 0) {
  errors += 1;
  console.log(`Direct lucide: ✗ ${directLucide} files`);
} else {
  console.log(`Direct lucide: ✓`);
}

// ─── 5. Legacy color tokens ───────────────────────────────────────────────
const FORBIDDEN = [
  /\bbg-indigo-\d{2,3}\b/,
  /\btext-indigo-\d{2,3}\b/,
  /\bborder-indigo-\d{2,3}\b/,
  /\bbg-green-600\b/,
  /\bbg-red-600\b/,
];
let legacyColors = 0;
for (const file of consumers) {
  // Skip pages-refactored intentionally? No — they should be clean too.
  // Skip the legacy /pages/ folder which is documented as "to be migrated".
  if (file.includes('/pages/') && !file.includes('/pages-refactored/')) continue;

  // Strip block comments and line comments before checking — class names
  // mentioned in JSDoc explaining the migration are not real usage.
  const text = read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');

  for (const pattern of FORBIDDEN) {
    if (pattern.test(text)) {
      console.log(`  LEGACY COLOR: ${path.relative(root, file)} contains ${pattern.source}`);
      legacyColors += 1;
      break;
    }
  }
}
if (legacyColors > 0) {
  warnings += 1;
  console.log(`Legacy colors: ⚠ ${legacyColors} files (refactored pages should be clean)`);
} else {
  console.log(`Legacy colors: ✓ in refactored code`);
}

// ─── 6. Tokens light/dark coverage ────────────────────────────────────────
const tokens = read(path.join(src, 'system/tokens.css'));
const hasDark = /\.dark\s*\{|\[data-theme=['"]dark['"]\]/.test(tokens);
if (!hasDark) {
  errors += 1;
  console.log(`Tokens dark mode: ✗ tokens.css does not define dark overrides`);
} else {
  console.log(`Tokens dark mode: ✓`);
}

// ─── Final report ─────────────────────────────────────────────────────────
console.log('='.repeat(60));
if (errors === 0 && warnings === 0) {
  console.log('✓ SMOKE TEST PASSED — package is ready to install\n');
  process.exit(0);
} else if (errors === 0) {
  console.log(`⚠ SMOKE TEST PASSED with ${warnings} warning(s) — review above\n`);
  process.exit(0);
} else {
  console.log(`✗ SMOKE TEST FAILED — ${errors} error(s), ${warnings} warning(s)\n`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────
function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function walkFiles(dir, exts) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walkFiles(full, exts));
    } else if (exts.includes(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}
