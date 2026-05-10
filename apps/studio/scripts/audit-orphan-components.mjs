import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const srcRoot = path.join(repoRoot, 'src');
const allowedRoots = new Set([
  path.join(srcRoot, 'main.tsx'),
  path.join(srcRoot, 'App.tsx'),
]);
const ignoredKnownOrphans = new Set([
  'src/app/shell/StatusChip.tsx',
  'src/app/shell/topbar/TopBarPrimaryActions.tsx',
  'src/app/shell/topbar/TopBarStatus.tsx',
  'src/inspector/sections/WidgetUtilitiesSection.tsx',
  'src/inspector/sections/document/ExportSection.tsx',
  'src/inspector/sections/document/ProjectContextSection.tsx',
  'src/inspector/sections/document/ReleaseSettingsSection.tsx',
  'src/inspector/sections/document/StoryInfoSection.tsx',
  'src/platform/agency-shell/AgencyCommandHero.tsx',
  'src/platform/agency-shell/AgencyShellEmptyState.tsx',
  'src/platform/agency-shell/ClientRail.tsx',
  'src/platform/agency-shell/ReviewActivityRail.tsx',
  'src/platform/template-gallery/TemplateFilters.tsx',
  'src/platform/template-gallery/TemplateGallery.tsx',
  'src/widgets/modules/gallery-assets-inspector.tsx',
  'src/widgets/modules/module-inspector.tsx',
  'src/widgets/modules/modules.renderer.tsx',
  'src/widgets/modules/shared.tsx',
]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const target = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(target);
    return [target];
  }));
  return files.flat();
}

function isSourceFile(file) {
  if (!file.startsWith(srcRoot)) return false;
  if (!/\.(ts|tsx)$/.test(file)) return false;
  if (/(\.test|\.spec)\.(ts|tsx)$/.test(file)) return false;
  return true;
}

function isComponentCandidate(file) {
  return file.endsWith('.tsx') && !allowedRoots.has(file);
}

function extractLocalSpecifiers(source) {
  const specifiers = new Set();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\w*\s{},]+)\s+from\s+['"](\.[^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?(?:[\w*\s{},]+)\s+from\s+['"](\.[^'"]+)['"]/g,
    /\bimport\(\s*['"](\.[^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) {
      specifiers.add(match[1]);
    }
  }

  return [...specifiers];
}

async function resolveLocalImport(fromFile, specifier) {
  const base = path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    base,
    `${base}.ts`,
    `${base}.tsx`,
    `${base}.js`,
    `${base}.jsx`,
    path.join(base, 'index.ts'),
    path.join(base, 'index.tsx'),
    path.join(base, 'index.js'),
    path.join(base, 'index.jsx'),
  ];

  for (const candidate of candidates) {
    try {
      const content = await readFile(candidate);
      if (content) return candidate;
    } catch {
      // Try next candidate.
    }
  }

  return null;
}

const sourceFiles = (await walk(srcRoot)).filter(isSourceFile);
const inboundImports = new Map();

for (const file of sourceFiles) {
  inboundImports.set(file, new Set());
}

for (const file of sourceFiles) {
  const source = await readFile(file, 'utf8');
  const localSpecifiers = extractLocalSpecifiers(source);
  for (const specifier of localSpecifiers) {
    const resolved = await resolveLocalImport(file, specifier);
    if (!resolved || !inboundImports.has(resolved)) continue;
    inboundImports.get(resolved).add(file);
  }
}

const orphanComponents = [...inboundImports.entries()]
  .filter(([file, importers]) => isComponentCandidate(file) && importers.size === 0)
  .map(([file]) => path.relative(repoRoot, file))
  .filter((file) => !ignoredKnownOrphans.has(file))
  .sort();

if (orphanComponents.length > 0) {
  console.error('Orphan component files detected:');
  orphanComponents.forEach((file) => console.error(` - ${file}`));
  process.exit(1);
}

console.log('All component files have at least one importer.');
