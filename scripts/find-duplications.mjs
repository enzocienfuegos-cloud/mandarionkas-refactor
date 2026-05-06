#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Audit tool: find-duplications
 * -----------------------------
 * Scans the codebase for symbols that the design system already provides
 * but pages still define inline. Reports counts so you can prioritise
 * which page to migrate next.
 *
 * Usage:
 *   node scripts/find-duplications.mjs apps/web/src
 */

import fs from 'node:fs';
import path from 'node:path';

const SIGNALS = [
  // Symbol-level duplication signals
  { name: 'Inline MetricCard',     pattern: /(?:function|const)\s+MetricCard\b/ },
  { name: 'Inline Sparkline',      pattern: /(?:function|const)\s+Sparkline\b/ },
  { name: 'Inline Skeleton',       pattern: /(?:function|const)\s+Skeleton\b/ },
  { name: 'Inline Spinner',        pattern: /(?:function|const)\s+Spinner\b/ },
  { name: 'Inline Modal',          pattern: /(?:function|const)\s+Modal\b/ },
  { name: 'Inline Toast/Notif',    pattern: /(?:function|const)\s+(Toast|Notification|Banner)\b/ },
  { name: 'Inline Badge',          pattern: /(?:function|const)\s+(Badge|Pill|Tag)\b(?!Icon)/ },
  { name: 'Inline DataTable wrapper', pattern: /(?:function|const)\s+(DataTable|Table)\b/ },

  // Pattern-level signals
  { name: 'window.confirm',                pattern: /window\.confirm\s*\(/ },
  { name: 'alert(',                        pattern: /\balert\s*\(/ },
  { name: 'Hardcoded brand gradient',      pattern: /bg-\[linear-gradient\([^)]*F1008B/i },
  { name: 'Legacy indigo-* color',         pattern: /\b(?:bg|text|border|ring)-indigo-\d{2,3}\b/ },
  { name: 'Generic green-600 button',      pattern: /bg-green-600\b/ },
  { name: 'Generic red-600 button',        pattern: /bg-red-600\b/ },
  { name: 'Direct lucide-react import',    pattern: /from\s+['"]lucide-react['"]/ },
  { name: 'Emoji icon (▶ ⏸ ■ 📊)',          pattern: /[▶⏸■◼◻]|📊|📈|📉|⚠️|🔥/ },
];

const TARGET_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx']);

const root = process.argv[2] ?? 'apps/web/src';

/** Map<signalName, Map<filePath, occurrenceCount>> */
const findings = new Map();
let totalFiles = 0;

walk(root);

// Print report
console.log('');
console.log('Design system duplication audit');
console.log('================================');
console.log(`Scanned ${totalFiles} files under ${root}`);
console.log('');

const ranked = SIGNALS.map((signal) => {
  const fileMap = findings.get(signal.name) ?? new Map();
  const total   = Array.from(fileMap.values()).reduce((a, b) => a + b, 0);
  return { signal, fileMap, total };
}).sort((a, b) => b.total - a.total);

for (const { signal, fileMap, total } of ranked) {
  if (total === 0) continue;
  console.log(`${signal.name}`.padEnd(40) + `${total} occurrences in ${fileMap.size} files`);
  // Top 5 files
  const top = Array.from(fileMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  for (const [filePath, count] of top) {
    console.log(`   ${count.toString().padStart(3)}  ${path.relative('.', filePath)}`);
  }
  console.log('');
}

// Suggested ordering
const fileScore = new Map();
for (const { fileMap } of ranked) {
  for (const [filePath, count] of fileMap.entries()) {
    fileScore.set(filePath, (fileScore.get(filePath) ?? 0) + count);
  }
}
const sortedFiles = Array.from(fileScore.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

console.log('Suggested migration order (most violations first)');
console.log('--------------------------------------------------');
for (const [filePath, score] of sortedFiles) {
  console.log(`${score.toString().padStart(4)}  ${path.relative('.', filePath)}`);
}

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
    } else if (TARGET_EXTENSIONS.has(path.extname(entry.name))) {
      processFile(full);
    }
  }
}

function processFile(filePath) {
  // Skip the system itself.
  if (filePath.includes('/system/')) return;
  if (filePath.includes('/pages-refactored/')) return;

  totalFiles += 1;
  const content = fs.readFileSync(filePath, 'utf8');

  for (const signal of SIGNALS) {
    const matches = content.match(new RegExp(signal.pattern, 'g'));
    if (!matches) continue;

    let map = findings.get(signal.name);
    if (!map) {
      map = new Map();
      findings.set(signal.name, map);
    }
    map.set(filePath, matches.length);
  }
}
