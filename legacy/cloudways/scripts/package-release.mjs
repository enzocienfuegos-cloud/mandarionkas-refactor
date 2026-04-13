import { mkdirSync, rmSync, existsSync, copyFileSync, cpSync, writeFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');
const releaseRoot = join(projectRoot, 'release');
const packageRoot = join(releaseRoot, 'Mandarionkas Stable React');
const zipPath = join(releaseRoot, 'Mandarionkas_Stable_React_Release.zip');
const manifestPath = join(releaseRoot, 'release-manifest.json');

const includePaths = [
  'README.md',
  'index.html',
  'index.php',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.app.json',
  'vite.config.ts',
  'docs',
  'docs-platform-api.md',
  'server',
  'src',
  'scripts',
  '.github',
  '.gitignore',
];

rmSync(releaseRoot, { recursive: true, force: true });
mkdirSync(packageRoot, { recursive: true });

for (const relativePath of includePaths) {
  const sourcePath = join(projectRoot, relativePath);
  const destinationPath = join(packageRoot, relativePath);
  if (!existsSync(sourcePath)) continue;
  const stats = statSync(sourcePath);
  if (stats.isDirectory()) {
    cpSync(sourcePath, destinationPath, { recursive: true });
  } else {
    mkdirSync(dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  }
}

const manifest = {
  artifact: 'Mandarionkas_Stable_React_Release.zip',
  packagedAt: new Date().toISOString(),
  rootFolder: 'Mandarionkas Stable React',
  includedPaths: includePaths,
  excludedByPolicy: ['node_modules', 'dist', '.env', 'platform-api.log', '.DS_Store'],
  notes: [
    'This artifact is a clean source release package, not a production export bundle.',
    'Run npm ci before local development or verification.',
  ],
};

writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
execFileSync('zip', ['-qr', zipPath, 'Mandarionkas Stable React'], { cwd: releaseRoot, stdio: 'inherit' });
console.log(`Packaged clean release artifact at ${zipPath}`);
