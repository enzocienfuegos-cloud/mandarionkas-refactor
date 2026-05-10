import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const required = [
  'src',
  'server',
  'package.json',
  '.github/workflows/ci.yml',
  'docs/release/README.md',
  'scripts/package-release.mjs',
  'scripts/run-release-checks.mjs',
];

const failures = [];

for (const relativePath of required) {
  if (!existsSync(join(root, relativePath))) {
    failures.push(`Missing required path: ${relativePath}`);
  }
}

const forbiddenRootEntries = ['app', 'core', 'widgets', 'platform', 'domain'];
for (const entry of forbiddenRootEntries) {
  const candidate = join(root, entry);
  if (existsSync(candidate) && statSync(candidate).isDirectory()) {
    failures.push(`Forbidden root-level legacy mirror present: ${entry}/`);
  }
}

const ignoredArtifacts = ['node_modules', 'dist'];
for (const artifact of ignoredArtifacts) {
  const candidate = join(root, artifact);
  if (!existsSync(candidate)) {
    continue;
  }
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    failures.push(`Expected .gitignore entry for ${artifact}/ but .gitignore is missing`);
    continue;
  }
  const gitignore = readFileSync(gitignorePath, 'utf8');
  const allowedPatterns = [`${artifact}/`, artifact];
  if (!allowedPatterns.some((pattern) => gitignore.includes(pattern))) {
    failures.push(`Expected .gitignore entry for ${artifact}/`);
  }
}

const topLevelFiles = readdirSync(root);
if (topLevelFiles.includes('platform-api.log')) {
  const gitignorePath = join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    failures.push('platform-api.log should be ignored in .gitignore');
  } else {
    const gitignore = readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('platform-api.log')) {
      failures.push('platform-api.log should be ignored in .gitignore');
    }
  }
}

if (failures.length > 0) {
  console.error('[repo-policy] Verification failed:');
  for (const failure of failures) {
    console.error(` - ${failure}`);
  }
  process.exit(1);
}

console.log('[repo-policy] Repository policy checks passed.');
