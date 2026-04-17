import { spawnSync } from 'node:child_process';

const steps = [
  { name: 'typecheck', command: 'npm', args: ['run', 'typecheck'] },
  { name: 'build', command: 'npm', args: ['run', 'build'] },
];

const runStep = ({ name, command, args }) => {
  console.log(`\n[release-checks] Running ${name}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env,
  });

  if (typeof result.status === 'number' && result.status !== 0) {
    throw new Error(`[release-checks] ${name} failed with exit code ${result.status}`);
  }

  if (result.error) {
    throw result.error;
  }
};

for (const step of steps) {
  runStep(step);
}

console.log('\n[release-checks] Baseline release checks passed.');
console.log('[release-checks] Note: Vitest is intentionally not part of this script because some sandbox/container environments do not support its worker model reliably. Run npm run test locally or in CI.');
