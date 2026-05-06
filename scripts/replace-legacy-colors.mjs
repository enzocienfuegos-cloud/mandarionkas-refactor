#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */

/**
 * Codemod: replace-legacy-colors
 * ------------------------------
 * Sweeps through .tsx/.ts/.css files and replaces legacy Tailwind color
 * tokens with the design-system equivalents.
 *
 * Usage:
 *   node scripts/replace-legacy-colors.mjs apps/web/src
 *   node scripts/replace-legacy-colors.mjs apps/web/src --dry
 *
 * --dry  Print what would change, don't write.
 *
 * NOTE: This handles the easy mechanical cases. Complex contexts
 * (e.g. <button className="bg-green-600 ..."> as a primary action) still
 * need a human to decide between Button variant="primary" / "danger".
 * The ESLint rule will surface those after this codemod runs.
 */

import fs from 'node:fs';
import path from 'node:path';

const REPLACEMENTS = [
  // indigo → brand
  [/\bbg-indigo-50\b/g,         'bg-brand-50'],
  [/\bbg-indigo-100\b/g,        'bg-brand-100'],
  [/\bbg-indigo-200\b/g,        'bg-brand-200'],
  [/\bbg-indigo-500\b/g,        'bg-brand-500'],
  [/\bbg-indigo-600\b/g,        'bg-brand-500'],
  [/\bbg-indigo-700\b/g,        'bg-brand-600'],
  [/\bhover:bg-indigo-600\b/g,  'hover:bg-brand-600'],
  [/\bhover:bg-indigo-700\b/g,  'hover:bg-brand-700'],
  [/\btext-indigo-500\b/g,      'text-brand-500'],
  [/\btext-indigo-600\b/g,      'text-text-brand'],
  [/\btext-indigo-700\b/g,      'text-text-brand'],
  [/\bborder-indigo-200\b/g,    'border-brand-200'],
  [/\bborder-indigo-300\b/g,    'border-brand-300'],
  [/\bborder-indigo-500\b/g,    'border-brand-500'],
  [/\bring-indigo-500\b/g,      'ring-brand-500'],
  [/\bfocus:ring-indigo-500\b/g, 'focus:ring-brand-500'],
  [/\bfocus:border-indigo-500\b/g, 'focus:border-brand-500'],

  // semantic surfaces (gray → token)
  [/\bbg-white\b/g,             'bg-surface-1'],
  [/\bbg-gray-50\b/g,           'bg-surface-muted'],
  [/\bbg-gray-100\b/g,          'bg-surface-muted'],
  [/\btext-gray-400\b/g,        'text-text-soft'],
  [/\btext-gray-500\b/g,        'text-text-muted'],
  [/\btext-gray-600\b/g,        'text-text-muted'],
  [/\btext-gray-700\b/g,        'text-text-secondary'],
  [/\btext-gray-800\b/g,        'text-text-primary'],
  [/\btext-gray-900\b/g,        'text-text-primary'],
  [/\bborder-gray-100\b/g,      'border-border-subtle'],
  [/\bborder-gray-200\b/g,      'border-border-default'],
  [/\bborder-gray-300\b/g,      'border-border-strong'],

  // slate
  [/\btext-slate-500\b/g,       'text-text-muted'],
  [/\btext-slate-600\b/g,       'text-text-muted'],
  [/\btext-slate-700\b/g,       'text-text-secondary'],
  [/\btext-slate-800\b/g,       'text-text-primary'],
  [/\btext-slate-900\b/g,       'text-text-primary'],
  [/\bborder-slate-200\b/g,     'border-border-default'],
  [/\bborder-slate-300\b/g,     'border-border-strong'],
];

// CAUTION: do not auto-replace bg-green-600 / bg-red-600 — those are most
// often used as primary/danger buttons and need <Button variant=...>.
// We leave them for the ESLint rule to flag, then humans decide.

const args  = process.argv.slice(2);
const dry   = args.includes('--dry');
const root  = args.find((a) => !a.startsWith('--')) ?? 'apps/web/src';

const TARGET_EXTENSIONS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css']);

const stats = { files: 0, edits: 0, changed: 0 };

walk(root);

console.log('');
console.log(`Scanned: ${stats.files} files`);
console.log(`Edits:   ${stats.edits}`);
console.log(`Changed: ${stats.changed} files`);
if (dry) console.log('(dry run — no files were written)');

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
  // Skip the design system itself and the codemod target files.
  if (filePath.includes('/system/')) return;
  if (filePath.includes('/shell/')) return;
  if (filePath.endsWith('tokens.css')) return;
  if (filePath.endsWith('index.css')) return;

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
