import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LayerName } from './layer-rules';
import { layerOrder } from './layer-rules';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const projectRoot = path.resolve(__dirname, '../../..');
export const srcRoot = path.join(projectRoot, 'src');

export type SourceFile = { relativePath: string; content: string };

type AliasName =
  | '@actions'
  | '@app'
  | '@assets'
  | '@canvas'
  | '@core'
  | '@domain'
  | '@export'
  | '@hooks'
  | '@inspector'
  | '@platform'
  | '@repositories'
  | '@shared'
  | '@testing'
  | '@timeline'
  | '@widgets';

const aliasMap: Record<AliasName, string> = {
  '@actions': 'src/actions',
  '@app': 'src/app',
  '@assets': 'src/assets',
  '@canvas': 'src/canvas',
  '@core': 'src/core',
  '@domain': 'src/domain',
  '@export': 'src/export',
  '@hooks': 'src/hooks',
  '@inspector': 'src/inspector',
  '@platform': 'src/platform',
  '@repositories': 'src/repositories',
  '@shared': 'src/shared',
  '@testing': 'src/testing',
  '@timeline': 'src/timeline',
  '@widgets': 'src/widgets',
};

export function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(fullPath);
    if (!entry.isFile() || (!fullPath.endsWith('.ts') && !fullPath.endsWith('.tsx'))) return [];
    return [fullPath];
  });
}

export function readSourceFiles(): SourceFile[] {
  return walk(srcRoot)
    .filter((filePath) => !filePath.includes(`${path.sep}testing${path.sep}`))
    .map((filePath) => ({
      relativePath: path.relative(projectRoot, filePath).split(path.sep).join('/'),
      content: fs.readFileSync(filePath, 'utf8'),
    }));
}

export function importedSpecifiers(content: string): string[] {
  const staticImports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  const dynamicImports = [...content.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map((match) => match[1]);
  return [...staticImports, ...dynamicImports];
}

export function sourceLayer(relativePath: string): LayerName | null {
  const [root, layer] = relativePath.split('/');
  if (root !== 'src' || !layer) return null;
  return layerOrder.includes(layer as LayerName) ? (layer as LayerName) : null;
}

export function resolveImportPath(fromRelativePath: string, specifier: string): string | null {
  if (specifier.startsWith('.')) {
    const fromDir = path.posix.dirname(fromRelativePath);
    return path.posix.normalize(path.posix.join(fromDir, specifier));
  }

  const aliasEntry = Object.entries(aliasMap).find(([alias]) => specifier === alias || specifier.startsWith(`${alias}/`));
  if (aliasEntry) {
    const [alias, target] = aliasEntry;
    return specifier === alias ? target : path.posix.join(target, specifier.slice(alias.length + 1));
  }

  if (specifier.startsWith('src/')) return specifier;
  return null;
}

export function targetLayer(fromRelativePath: string, specifier: string): LayerName | null {
  const resolved = resolveImportPath(fromRelativePath, specifier);
  return resolved ? sourceLayer(resolved) : null;
}
