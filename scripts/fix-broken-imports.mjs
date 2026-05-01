#!/usr/bin/env node
// scripts/fix-broken-imports.mjs
//
// AUDIT FIX — Sprint 44 integration
//
// The migrate-imports.mjs script had a bug: it converted relative imports
// to @smx/*/src/<LINE_NUMBER> instead of @smx/*/src/<filename>.mjs
// This produced 23 files with invalid import paths that break at runtime.
//
// Additionally, some imports from apps/api/src/lib/http.mjs (a relative
// internal import) got incorrectly aliased as @smx/db/src/<number>.
//
// This script applies all corrections deterministically.
//
// Usage: node scripts/fix-broken-imports.mjs [--dry-run]
// Safe to run multiple times (idempotent).

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT    = resolve(fileURLToPath(import.meta.url), '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Complete replacement table ────────────────────────────────────────────
// Built from audit: function-name matching against package exports.
// Format: [brokenImport, correctImport]

const REPLACEMENTS = [
  // ── @smx/db — pool ──────────────────────────────────────────────────────
  ["'@smx/db/src/24'",  "'@smx/db/src/pool.mjs'"],
  ["'@smx/db/src/66'",  "'@smx/db/src/pool.mjs'"],
  ["'@smx/db/src/71'",  "'@smx/db/src/pool.mjs'"],
  ["'@smx/db/src/201'", "'@smx/db/src/pool.mjs'"],
  ["'@smx/db/src/228'", "'@smx/db/src/pool.mjs'"],

  // ── @smx/db — tracking ──────────────────────────────────────────────────
  ["'@smx/db/src/34'",  "'@smx/db/src/tracking.mjs'"],
  ["'@smx/db/src/134'", "'@smx/db/src/tracking.mjs'"],
  ["'@smx/db/src/345'", "'@smx/db/src/tracking.mjs'"],

  // ── @smx/db — audit ─────────────────────────────────────────────────────
  ["'@smx/db/src/192'", "'@smx/db/src/audit.mjs'"],
  ["'@smx/db/src/431'", "'@smx/db/src/audit.mjs'"],
  ["'@smx/db/src/553'", "'@smx/db/src/audit.mjs'"],
  ["'@smx/db/src/560'", "'@smx/db/src/audit.mjs'"],

  // ── @smx/db — tags ──────────────────────────────────────────────────────
  ["'@smx/db/src/204'", "'@smx/db/src/tags.mjs'"],

  // ── @smx/db — tag-health ────────────────────────────────────────────────
  ["'@smx/db/src/254'", "'@smx/db/src/tag-health.mjs'"],

  // ── @smx/db — reporting ─────────────────────────────────────────────────
  ["'@smx/db/src/349'", "'@smx/db/src/reporting.mjs'"],
  ["'@smx/db/src/643'", "'@smx/db/src/reporting.mjs'"],

  // ── @smx/db — search ────────────────────────────────────────────────────
  ["'@smx/db/src/186'", "'@smx/db/src/search.mjs'"],

  // ── @smx/db — vast ──────────────────────────────────────────────────────
  ["'@smx/db/src/223'", "'@smx/db/src/vast.mjs'"],
  ["'@smx/db/src/425'", "'@smx/db/src/vast.mjs'"],

  // ── @smx/db — pixels ────────────────────────────────────────────────────
  ["'@smx/db/src/328'", "'@smx/db/src/pixels.mjs'"],

  // ── @smx/db — asset-jobs ────────────────────────────────────────────────
  ["'@smx/db/src/257'", "'@smx/db/src/asset-jobs.mjs'"],

  // ── @smx/db — creatives ─────────────────────────────────────────────────
  ["'@smx/db/src/505'", "'@smx/db/src/creatives.mjs'"],
  ["'@smx/db/src/666'", "'@smx/db/src/creatives.mjs'"],

  // ── @smx/db — discrepancies ─────────────────────────────────────────────
  ["'@smx/db/src/287'", "'@smx/db/src/discrepancies.mjs'"],

  // ── @smx/db — pacing ────────────────────────────────────────────────────
  ["'@smx/db/src/273'", "'@smx/db/src/pacing.mjs'"],

  // ── @smx/db — webhooks ──────────────────────────────────────────────────
  ["'@smx/db/src/274'", "'@smx/db/src/webhooks.mjs'"],

  // ── @smx/db — api-keys ──────────────────────────────────────────────────
  ["'@smx/db/src/229'", "'@smx/db/src/api-keys.mjs'"],

  // ── @smx/db — experiments ───────────────────────────────────────────────
  ["'@smx/db/src/319'", "'@smx/db/src/experiments.mjs'"],

  // ── @smx/db — campaigns ─────────────────────────────────────────────────
  ["'@smx/db/src/313'", "'@smx/db/src/campaigns.mjs'"],

  // ── @smx/config ─────────────────────────────────────────────────────────
  ["'@smx/config/src/43'",  "'@smx/config/src/env.mjs'"],
  ["'@smx/config/src/151'", "'@smx/config/src/security.mjs'"],

  // ── @smx/r2 ─────────────────────────────────────────────────────────────
  ["'@smx/r2/src/448'", "'@smx/r2/src/client.mjs'"],

  // ── lib/http.mjs — these are INTERNAL imports that got broken.
  //    They appear as @smx/db/src/<number> but belong to apps/api/src/lib/http.mjs.
  //    The pattern: the imports are { badRequest, sendJson, serviceUnavailable, ... }
  //    which exist in lib/http.mjs not in @smx/db.
  //    These must be fixed file-by-file because the correct relative path differs
  //    per directory depth. See FILE_SPECIFIC_FIXES below.
];

// ─── File-specific fixes (lib/http.mjs relative path) ─────────────────────
// For files where the broken number actually points to lib/http.mjs functions
// (badRequest, sendJson, forbidden, unauthorized, serviceUnavailable, conflict)
// The correct import is a relative path back to apps/api/src/lib/http.mjs.

const HTTP_FN_PATTERN = /\b(badRequest|sendJson|forbidden|unauthorized|serviceUnavailable|conflict|sendNoContent|notFound)\b/;

const FILE_SPECIFIC_FIXES = {
  // adserver modules (6 levels deep from apps/api/src)
  'apps/api/src/modules/adserver/discrepancies/routes.mjs': {
    broken: "'@smx/db/src/287'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/pacing/routes.mjs': {
    broken: "'@smx/db/src/273'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/api-keys/routes.mjs': {
    broken: "'@smx/db/src/229'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/campaigns/routes.mjs': {
    broken: "'@smx/db/src/313'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/experiments/routes.mjs': {
    broken: "'@smx/db/src/319'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/webhooks/routes.mjs': {
    broken: "'@smx/db/src/274'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/reporting/routes.mjs': {
    broken: "'@smx/db/src/643'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/tags/routes.mjs': {
    broken: "'@smx/db/src/666'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/vast/routes.mjs': {
    broken: "'@smx/db/src/425'",
    correct: "'../../../lib/http.mjs'",
  },
  'apps/api/src/modules/adserver/tracking/routes.mjs': {
    broken: "'@smx/db/src/345'",
    correct: "'../../../lib/http.mjs'",
  },
  // worker generate-image-derivatives: node:fs/promises was misrouted
  'apps/worker/src/jobs/generate-image-derivatives.mjs': {
    broken: "'@smx/db/src/419'",
    correct: "'node:fs/promises'",
  },
};

// ─── File discovery ────────────────────────────────────────────────────────

import { readdirSync, statSync } from 'node:fs';

function findMjsFiles(dir) {
  const results = [];
  function walk(current) {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = `${current}/${entry.name}`;
      if (entry.isDirectory() && !['node_modules', '.git', '__MACOSX', 'dist'].includes(entry.name)) {
        walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        results.push(full);
      }
    }
  }
  walk(dir);
  return results;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\nAudit Fix: Broken numeric imports${DRY_RUN ? ' [DRY RUN]' : ''}`);
  console.log('─'.repeat(60));

  const files = [
    ...findMjsFiles(`${ROOT}/apps`),
    ...findMjsFiles(`${ROOT}/packages`),
  ];

  let totalFiles = 0;
  let totalChanges = 0;

  for (const filePath of files) {
    const relPath = filePath.replace(ROOT + '/', '');
    let content = await readFile(filePath, 'utf8');
    let modified = false;
    const changes = [];

    // Apply global replacements
    for (const [broken, correct] of REPLACEMENTS) {
      if (content.includes(broken)) {
        content = content.replaceAll(broken, correct);
        changes.push(`${broken} → ${correct}`);
        modified = true;
      }
    }

    // Apply file-specific fixes
    const fileFix = FILE_SPECIFIC_FIXES[relPath];
    if (fileFix && content.includes(fileFix.broken)) {
      content = content.replaceAll(fileFix.broken, fileFix.correct);
      changes.push(`[FILE-SPECIFIC] ${fileFix.broken} → ${fileFix.correct}`);
      modified = true;
    }

    if (!modified) continue;

    totalFiles++;
    totalChanges += changes.length;

    console.log(`\n📝 ${relPath}`);
    for (const change of changes) {
      console.log(`   ${change}`);
    }

    if (!DRY_RUN) {
      await writeFile(filePath, content, 'utf8');
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log(`Fixed: ${totalFiles} files, ${totalChanges} import statements`);

  if (DRY_RUN) {
    console.log('\n⚠️  Dry run — no files modified. Remove --dry-run to apply.');
  } else {
    console.log('\n✅ Done. Run npm run check:api to verify.');
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
