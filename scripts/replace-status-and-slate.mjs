#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Codemod stage 2: replace-status-and-slate
 * -----------------------------------------
 * Run AFTER replace-legacy-colors.mjs. Handles the patterns that need
 * judgement — status badges (green-100/red-100), slate-* surface
 * variants, and miscellaneous indigo-* leftovers.
 *
 * Usage:
 *   node scripts/replace-status-and-slate.mjs apps/web/src/api-keys
 */

import fs from 'node:fs';
import path from 'node:path';

const REPLACEMENTS = [
  // Status badges — soft tone (used in inline labels)
  [/\bbg-green-100\s+text-green-800\b/g, "bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]"],
  [/\bbg-green-100\s+text-green-700\b/g, "bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)]"],
  [/\bbg-red-100\s+text-red-800\b/g,     "bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]"],
  [/\bbg-red-100\s+text-red-700\b/g,     "bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)]"],
  [/\bbg-yellow-100\s+text-yellow-800\b/g, "bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]"],
  [/\bbg-yellow-100\s+text-yellow-700\b/g, "bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]"],
  [/\bbg-amber-100\s+text-amber-800\b/g,   "bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)]"],
  [/\bbg-blue-100\s+text-blue-800\b/g,     "bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]"],
  [/\bbg-blue-100\s+text-blue-700\b/g,     "bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)]"],

  // Error banners
  [/\bbg-red-50\s+border\s+border-red-200\s+rounded-lg\s+text-sm\s+text-red-700\b/g,
    "bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)] rounded-lg text-sm text-[color:var(--dusk-status-critical-fg)]"],
  [/\bbg-red-50\s+border\s+border-red-200\b/g,
    "bg-[color:var(--dusk-status-critical-bg)] border border-[color:var(--dusk-status-critical-border)]"],
  [/\bbg-yellow-50\s+border\s+border-yellow-200\b/g,
    "bg-[color:var(--dusk-status-warning-bg)] border border-[color:var(--dusk-status-warning-border)]"],
  [/\bbg-blue-50\s+border\s+border-blue-200\b/g,
    "bg-[color:var(--dusk-status-info-bg)] border border-[color:var(--dusk-status-info-border)]"],

  // Foreground status text alone
  [/\btext-red-700\b/g,    "text-[color:var(--dusk-status-critical-fg)]"],
  [/\btext-red-600\b/g,    "text-[color:var(--dusk-status-critical-fg)]"],
  [/\btext-green-700\b/g,  "text-[color:var(--dusk-status-success-fg)]"],
  [/\btext-green-600\b/g,  "text-[color:var(--dusk-status-success-fg)]"],
  [/\btext-yellow-700\b/g, "text-[color:var(--dusk-status-warning-fg)]"],
  [/\btext-amber-700\b/g,  "text-[color:var(--dusk-status-warning-fg)]"],
  [/\btext-blue-700\b/g,   "text-[color:var(--dusk-status-info-fg)]"],
  [/\btext-blue-600\b/g,   "text-[color:var(--dusk-status-info-fg)]"],

  // Hover button states — destructive
  [/\btext-red-600\s+hover:text-red-700\b/g, "text-[color:var(--dusk-status-critical-fg)] hover:opacity-80"],
  [/\bhover:bg-red-50\b/g,                   "hover:bg-[color:var(--dusk-status-critical-bg)]"],

  // Slate surface variants
  [/\bbg-slate-50\b/g,   "bg-[color:var(--dusk-surface-muted)]"],
  [/\bbg-slate-100\b/g,  "bg-[color:var(--dusk-surface-muted)]"],
  [/\bbg-slate-200\b/g,  "bg-[color:var(--dusk-surface-hover)]"],
  [/\bhover:bg-slate-50\b/g,  "hover:bg-[color:var(--dusk-surface-hover)]"],
  [/\bhover:bg-slate-100\b/g, "hover:bg-[color:var(--dusk-surface-hover)]"],
  [/\bhover:bg-slate-200\b/g, "hover:bg-[color:var(--dusk-surface-active)]"],
  [/\bborder-slate-100\b/g,   "border-[color:var(--dusk-border-subtle)]"],
  [/\bborder-slate-200\b/g,   "border-[color:var(--dusk-border-default)]"],
  [/\bborder-slate-300\b/g,   "border-[color:var(--dusk-border-strong)]"],
  [/\btext-slate-400\b/g,     "text-[color:var(--dusk-text-soft)]"],
  [/\btext-slate-500\b/g,     "text-[color:var(--dusk-text-muted)]"],
  [/\btext-slate-600\b/g,     "text-[color:var(--dusk-text-muted)]"],
  [/\btext-slate-700\b/g,     "text-[color:var(--dusk-text-secondary)]"],
  [/\btext-slate-800\b/g,     "text-[color:var(--dusk-text-primary)]"],
  [/\btext-slate-900\b/g,     "text-[color:var(--dusk-text-primary)]"],

  // Indigo leftovers (uncovered by stage 1, e.g. disabled states)
  [/\bbg-indigo-400\b/g,      "bg-brand-400"],
  [/\bdisabled:bg-indigo-400\b/g, "disabled:bg-brand-400"],
  [/\bbg-indigo-500\b/g,      "bg-brand-500"],

  // Scoped destructive button variant — common pattern in legacy
  [/\btext-red-600\s+hover:text-red-700\s+font-medium\s+px-2\s+py-1\s+rounded\s+hover:bg-red-50\b/g,
    "text-[color:var(--dusk-status-critical-fg)] font-medium px-2 py-1 rounded hover:bg-[color:var(--dusk-status-critical-bg)]"],
];

const args  = process.argv.slice(2);
const dry   = args.includes('--dry');
const root  = args.find((a) => !a.startsWith('--')) ?? 'apps/web/src';

const TARGET_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js']);

const stats = { files: 0, edits: 0, changed: 0 };

walk(root);

console.log('');
console.log(`Scanned: ${stats.files} files`);
console.log(`Edits:   ${stats.edits}`);
console.log(`Changed: ${stats.changed} files`);
if (dry) console.log('(dry run — no files were written)');

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const stat = fs.statSync(dir);
  if (stat.isFile()) {
    if (TARGET_EXTENSIONS.has(path.extname(dir))) processFile(dir);
    return;
  }
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
  // Don't touch the design system itself or already-clean refactored pages.
  if (filePath.includes('/system/')) return;
  if (filePath.includes('/shell/')) return;
  if (filePath.includes('/pages-refactored/')) return;
  if (filePath.endsWith('tokens.css')) return;

  stats.files += 1;
  const original = fs.readFileSync(filePath, 'utf8');
  let updated   = original;
  let fileEdits = 0;

  for (const [pattern, replacement] of REPLACEMENTS) {
    updated = updated.replace(pattern, () => {
      fileEdits += 1;
      return replacement;
    });
  }

  if (fileEdits > 0) {
    stats.edits   += fileEdits;
    stats.changed += 1;
    if (dry) {
      console.log(`would change: ${filePath} (${fileEdits} edits)`);
    } else {
      fs.writeFileSync(filePath, updated);
      console.log(`changed: ${filePath} (${fileEdits} edits)`);
    }
  }
}
