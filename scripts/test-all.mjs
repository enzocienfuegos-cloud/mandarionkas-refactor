/**
 * scripts/test-all.mjs
 *
 * Runs tests in every workspace that has test files.
 * - packages/* and apps/api|worker  → node --test  (Node built-in runner)
 * - apps/studio                     → vitest run   (studio uses vitest)
 *
 * No dependency on pnpm being in PATH.
 *
 * Usage:
 *   node scripts/test-all.mjs          # all workspaces
 *   node scripts/test-all.mjs db vast  # only matching workspaces
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// npm is always co-located with the node binary
const NPM  = path.join(path.dirname(process.execPath), 'npm');

// Workspaces that use node --test (Node built-in runner)
const NODE_TEST_WORKSPACES = [
  'packages/vast',
  'packages/vast-validator',
  'packages/db',
  'apps/api',
  'apps/worker',
];

// Workspaces that use vitest (npm test delegates to vitest run)
const VITEST_WORKSPACES = [
  'apps/studio',
];

// Optional filter from CLI args (e.g. "node test-all.mjs db vast")
const filter = process.argv.slice(2);

let total = 0, passed = 0, failed = 0;

function runWorkspace(label, result) {
  if (result.status === 0) {
    console.log(`✅  ${label} passed`);
    passed++;
  } else {
    console.error(`❌  ${label} failed (exit ${result.status})`);
    failed++;
  }
  total++;
}

// ── node --test workspaces ────────────────────────────────────────────────
for (const ws of NODE_TEST_WORKSPACES) {
  const wsPath  = path.join(ROOT, ws);
  const testsDir = path.join(wsPath, '__tests__');

  if (!existsSync(testsDir)) continue;
  const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  if (testFiles.length === 0) continue;
  if (filter.length > 0 && !filter.some(f => ws.includes(f))) continue;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${ws}  (${testFiles.length} file${testFiles.length > 1 ? 's' : ''})`);
  console.log('─'.repeat(60));

  runWorkspace(ws, spawnSync(
    process.execPath,
    ['--test', ...testFiles.map(f => path.join(testsDir, f))],
    { cwd: wsPath, stdio: 'inherit', encoding: 'utf8' },
  ));
}

// ── vitest workspaces ─────────────────────────────────────────────────────
for (const ws of VITEST_WORKSPACES) {
  const wsPath = path.join(ROOT, ws);
  if (!existsSync(wsPath)) continue;
  if (filter.length > 0 && !filter.some(f => ws.includes(f))) continue;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${ws}  (vitest)`);
  console.log('─'.repeat(60));

  runWorkspace(ws, spawnSync(
    NPM, ['test'],
    { cwd: wsPath, stdio: 'inherit', encoding: 'utf8' },
  ));
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Workspaces: ${total} total  |  ${passed} passed  |  ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
