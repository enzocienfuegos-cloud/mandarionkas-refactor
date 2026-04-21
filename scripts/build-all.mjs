/**
 * scripts/build-all.mjs
 *
 * Builds every workspace that has a "build" script, in dependency order.
 * No dependency on pnpm being in PATH — uses npm (always co-located with node).
 *
 * Usage:
 *   node scripts/build-all.mjs          # build all workspaces
 *   node scripts/build-all.mjs web      # only matching workspaces
 *
 * Fails fast on the first error: downstream builds depend on upstream packages.
 */
import { spawnSync }                       from 'node:child_process';
import { readFileSync, existsSync }        from 'node:fs';
import { fileURLToPath }                   from 'node:url';
import path                                from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// npm is bundled alongside every node binary — reliable without relying on PATH
const NPM = path.join(path.dirname(process.execPath), 'npm');

// Build order: packages first (deps), then apps (consumers)
const WORKSPACES = [
  'packages/contracts',
  'packages/vast',
  'packages/vast-validator',
  'packages/db',
  'packages/geo',
  'packages/storage',
  'apps/api',
  'apps/worker',
  'apps/web',
];

// Optional filter from CLI args  (e.g. "node build-all.mjs web")
const filter = process.argv.slice(2);

let total = 0, passed = 0, failed = 0;

for (const ws of WORKSPACES) {
  const wsPath  = path.join(ROOT, ws);
  const pkgPath = path.join(wsPath, 'package.json');
  if (!existsSync(pkgPath)) continue;

  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
  if (!pkg.scripts?.build) continue;

  // Apply CLI filter
  if (filter.length > 0 && !filter.some(f => ws.includes(f))) continue;

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`▶  ${ws}`);
  console.log(`   ${pkg.scripts.build}`);
  console.log('─'.repeat(60));

  const result = spawnSync(NPM, ['run', 'build'], {
    cwd:      wsPath,
    stdio:    'inherit',
    encoding: 'utf8',
  });

  if (result.status === 0) {
    console.log(`✅  ${ws} built`);
    passed++;
  } else {
    console.error(`❌  ${ws} FAILED (exit ${result.status})`);
    failed++;
    // Fail fast — downstream workspaces depend on upstream artifacts
    break;
  }
  total++;
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`Built: ${total} workspace${total !== 1 ? 's' : ''}  |  ${passed} ok  |  ${failed} failed`);
console.log('═'.repeat(60));

if (failed > 0) process.exit(1);
