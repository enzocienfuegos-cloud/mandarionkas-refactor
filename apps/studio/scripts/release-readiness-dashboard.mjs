import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '../../..');
const studioRoot = path.resolve(import.meta.dirname, '..');
const reportDir = path.resolve(repoRoot, 'artifacts/release-readiness/studio');
const stamp = new Date().toISOString().slice(0, 10);
const reportPath = path.join(reportDir, `studio-release-readiness-${stamp}.md`);

const checks = [
  { id: 'typecheck', label: 'Studio typecheck', command: 'npm run typecheck -w @smx/studio', cwd: repoRoot },
  { id: 'test', label: 'Studio unit/smoke/parity tests', command: 'npm run test -w @smx/studio', cwd: repoRoot },
  { id: 'build', label: 'Studio production build', command: 'npm run build -w @smx/studio', cwd: repoRoot },
  { id: 'audit', label: 'Studio visual debt audit', command: 'npm run audit:visual-debt -w @smx/studio', cwd: repoRoot },
  { id: 'visual', label: 'Studio visual regression', command: 'npm run test:visual -w @smx/studio', cwd: repoRoot },
  { id: 'api', label: 'API syntax safety', command: 'npm run check:api', cwd: repoRoot },
];

function runCheck(check) {
  const startedAt = Date.now();
  const result = spawnSync(check.command, {
    cwd: check.cwd,
    encoding: 'utf8',
    shell: true,
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
  });
  const durationMs = Date.now() - startedAt;
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return {
    ...check,
    ok: result.status === 0,
    durationMs,
    output,
    exitCode: result.status ?? 1,
  };
}

function parseAuditTotals(output) {
  const keys = [
    'inline styles',
    'color literals',
    'files over threshold',
    'numeric z-index uses',
    '!important uses',
    'hardcoded widget type branches',
  ];

  return Object.fromEntries(
    keys.map((key) => {
      const match = output.match(new RegExp(`- ${key}:\\s*(\\d+)`, 'i'));
      return [key, match ? Number(match[1]) : null];
    }),
  );
}

function readDistBudgets() {
  const distAssetsDir = path.join(studioRoot, 'dist/assets');
  if (!fs.existsSync(distAssetsDir)) {
    return { totalBytes: 0, files: [] };
  }

  const files = fs.readdirSync(distAssetsDir)
    .map((name) => {
      const filePath = path.join(distAssetsDir, name);
      const stats = fs.statSync(filePath);
      return {
        name,
        bytes: stats.size,
      };
    })
    .sort((a, b) => b.bytes - a.bytes);

  return {
    totalBytes: files.reduce((sum, file) => sum + file.bytes, 0),
    files,
  };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(durationMs) {
  if (durationMs < 1000) return `${durationMs} ms`;
  return `${(durationMs / 1000).toFixed(1)} s`;
}

function summarizeOutput(output, lineCount = 8) {
  const lines = output.split('\n').map((line) => line.trimEnd()).filter(Boolean);
  return lines.slice(-lineCount);
}

const results = checks.map(runCheck);
const auditTotals = parseAuditTotals(results.find((item) => item.id === 'audit')?.output ?? '');
const distBudgets = readDistBudgets();
const failed = results.filter((item) => !item.ok);

const markdown = [
  '# Studio Release Readiness',
  '',
  `Generated: ${new Date().toISOString()}`,
  '',
  '## Status',
  '',
  `- Overall: ${failed.length === 0 ? 'PASS' : 'FAIL'}`,
  `- Checks passed: ${results.length - failed.length}/${results.length}`,
  `- Report path: \`${reportPath}\``,
  '',
  '## Checks',
  '',
  ...results.map((result) => `- ${result.ok ? 'PASS' : 'FAIL'} ${result.label} · exit ${result.exitCode} · ${formatDuration(result.durationMs)}`),
  '',
  '## Visual Debt Snapshot',
  '',
  `- Inline styles: ${auditTotals['inline styles'] ?? 'n/a'}`,
  `- Files over threshold: ${auditTotals['files over threshold'] ?? 'n/a'}`,
  `- !important uses: ${auditTotals['!important uses'] ?? 'n/a'}`,
  `- Hardcoded widget type branches: ${auditTotals['hardcoded widget type branches'] ?? 'n/a'}`,
  `- Numeric z-index uses: ${auditTotals['numeric z-index uses'] ?? 'n/a'}`,
  `- Color literals: ${auditTotals['color literals'] ?? 'n/a'}`,
  '',
  '## Build Budgets',
  '',
  `- Total emitted asset weight: ${formatBytes(distBudgets.totalBytes)}`,
  ...distBudgets.files.slice(0, 10).map((file) => `- ${file.name}: ${formatBytes(file.bytes)}`),
  '',
  '## Command Tails',
  '',
  ...results.flatMap((result) => [
    `### ${result.label}`,
    '',
    '```txt',
    ...summarizeOutput(result.output),
    '```',
    '',
  ]),
];

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${markdown.join('\n').trim()}\n`, 'utf8');

console.log(`Studio release readiness report written to ${reportPath}`);
if (failed.length > 0) {
  console.error(`Release readiness failed on ${failed.length} check${failed.length === 1 ? '' : 's'}.`);
  process.exitCode = 1;
}
