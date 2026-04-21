/**
 * scripts/test-all.mjs
 *
 * Runs `node --test` in every workspace that has test files.
 * No dependency on pnpm, npm, or any other package manager being in PATH.
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

// Workspaces with real test files, in dependency order
const WORKSPACES = [
  'packages/vast',
  'packages/vast-validator',
  'packages/db',
  'apps/api',
  'apps/worker',
];

// Optional filter from CLI args (e.g. "node test-all.mjs db vast")
const filter = process.argv.slice(2);

let total = 0, passed = 0, failed = 0;

for (const ws of WORKSPACES) {
  const wsPath = path.join(ROOT, ws);
  const testsDir = path.join(wsPath, '__tests__');

  // Skip if __tests__ dir doesn't exist or is empty
  if (!existsSync(testsDir)) continue;
  const testFiles = readdirSync(testsDir).filter(f => f.endsWith('.mjs') || f.endsWith('.js'));
  if (testFiles.length === 0) continue;

  // Apply CLI filter
  if (filter.length > 0 && !filter.some(f => ws.includes(f))) continue;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${ws}  (${testFiles.length} file${testFiles.length > 1 ? 's' : ''})`);
  console.log('─'.repeat(60));

  const result = spawnSync(
    process.execPath,           // node binary — guaranteed in PATH
    ['--test', ...testFiles.map(f => path.join(testsDir, f))],
    { cwd: wsPath, stdio: 'inherit', encoding: 'utf8' },
  );

  if (result.status === 0) {
    console.log(`✅  ${ws} passed`);
    passed++;
  } else {
    console.error(`❌  ${ws} failed (exit ${result.status})`);
    failed++;
  }
  total++;
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Workspaces: ${total} total  |  ${passed} passed  |  ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
