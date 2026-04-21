/**
 * scripts/dev-all.mjs
 *
 * Starts apps/api, apps/worker and apps/web in parallel (dev mode).
 * No dependency on pnpm being in PATH — uses npm (always co-located with node).
 *
 * Ctrl-C kills all three child processes cleanly.
 *
 * Usage:
 *   node scripts/dev-all.mjs
 */
import { spawn }              from 'node:child_process';
import { fileURLToPath }      from 'node:url';
import path                   from 'node:path';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const NPM  = path.join(path.dirname(process.execPath), 'npm');

const APPS = [
  { name: 'api',    cwd: path.join(ROOT, 'apps/api') },
  { name: 'worker', cwd: path.join(ROOT, 'apps/worker') },
  { name: 'web',    cwd: path.join(ROOT, 'apps/web') },
];

// Colour prefixes for stdout interleaving
const COLOURS = ['\x1b[36m', '\x1b[33m', '\x1b[32m'];
const RESET   = '\x1b[0m';

const children = [];

for (const [i, app] of APPS.entries()) {
  const colour = COLOURS[i % COLOURS.length];
  const prefix = `${colour}[${app.name}]${RESET} `;

  const child = spawn(NPM, ['run', 'dev'], {
    cwd:   app.cwd,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  children.push(child);

  child.stdout.on('data', d =>
    process.stdout.write(d.toString().replace(/^/gm, prefix)));
  child.stderr.on('data', d =>
    process.stderr.write(d.toString().replace(/^/gm, prefix)));

  child.on('exit', (code, signal) => {
    if (code !== 0 && signal !== 'SIGTERM' && signal !== 'SIGINT') {
      console.error(`${prefix}exited with code ${code}`);
    }
  });
}

// Graceful Ctrl-C: kill all children
function shutdown() {
  for (const c of children) {
    try { c.kill('SIGTERM'); } catch {}
  }
  process.exit(0);
}

process.on('SIGINT',  shutdown);
process.on('SIGTERM', shutdown);

console.log('\x1b[1mStarting dev servers…\x1b[0m  (Ctrl-C to stop all)\n');
