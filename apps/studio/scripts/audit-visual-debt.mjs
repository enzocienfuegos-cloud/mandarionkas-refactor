import { readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative } from 'node:path';

const studioRoot = new URL('..', import.meta.url);
const srcRoot = new URL('../src', import.meta.url);

const SCANNED_EXTENSIONS = new Set(['.ts', '.tsx', '.css']);
const BRAND_COMMENT = '// brand:';
const BRAND_PALETTE_DECLARATION = /BrandPalette\s*=\s*{/;
const INLINE_STYLE_PATTERN = /style=\{\{/g;
const COLOR_LITERAL_PATTERN = /#(?:[0-9a-fA-F]{3,8})\b|rgba?\([^)]*\)|hsla?\([^)]*\)/g;
const Z_INDEX_PATTERN = /\bz-index\s*:\s*-?\d+\b/g;
const IMPORTANT_PATTERN = /!important\b/g;
const TYPE_BRANCH_PATTERN = /\b(?:widget|node)\.type\s*===\s*['"][^'"]+['"]/g;

const DEFAULT_TOP = 20;
const DEFAULT_LINE_THRESHOLD = 400;
const DEFAULT_RATCHET_THRESHOLDS = {
  inlineStyles: 0,
  importantCount: 0,
};

function parseArgs(argv) {
  const args = {
    lineThreshold: DEFAULT_LINE_THRESHOLD,
    top: DEFAULT_TOP,
    thresholds: {},
    ratchet: false,
  };

  argv.forEach((entry) => {
    if (entry === '--ratchet') {
      args.ratchet = true;
      return;
    }
    if (!entry.startsWith('--')) return;
    const [rawKey, rawValue] = entry.slice(2).split('=');
    const value = rawValue === undefined ? '' : rawValue;
    switch (rawKey) {
      case 'line-threshold':
        args.lineThreshold = Number(value) || DEFAULT_LINE_THRESHOLD;
        break;
      case 'top':
        args.top = Number(value) || DEFAULT_TOP;
        break;
      case 'max-inline-styles':
        args.thresholds.inlineStyles = Number(value);
        break;
      case 'max-color-literals':
        args.thresholds.colorLiterals = Number(value);
        break;
      case 'max-large-files':
        args.thresholds.largeFiles = Number(value);
        break;
      case 'max-z-index':
        args.thresholds.zIndexCount = Number(value);
        break;
      case 'max-important':
        args.thresholds.importantCount = Number(value);
        break;
      case 'max-type-branches':
        args.thresholds.typeBranches = Number(value);
        break;
      default:
        break;
    }
  });

  if (args.ratchet) {
    args.thresholds = {
      ...DEFAULT_RATCHET_THRESHOLDS,
      ...args.thresholds,
    };
  }

  return args;
}

function* walk(dirPath) {
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      if (entry === 'dist' || entry === 'node_modules') continue;
      yield* walk(fullPath);
      continue;
    }
    if (!SCANNED_EXTENSIONS.has(extname(fullPath))) continue;
    yield fullPath;
  }
}

function countMatches(content, pattern) {
  return content.match(pattern)?.length ?? 0;
}

function countBraceDelta(line) {
  const opens = (line.match(/{/g) ?? []).length;
  const closes = (line.match(/}/g) ?? []).length;
  return opens - closes;
}

function countColorLiterals(relativePath, content) {
  if (!relativePath.endsWith('.ts') && !relativePath.endsWith('.tsx')) {
    return countMatches(content, COLOR_LITERAL_PATTERN);
  }

  const lines = content.split('\n');
  let insideBrandPalette = false;
  let brandPaletteDepth = 0;
  let count = 0;

  lines.forEach((line) => {
    if (!insideBrandPalette && BRAND_PALETTE_DECLARATION.test(line)) {
      insideBrandPalette = true;
      brandPaletteDepth = countBraceDelta(line);
      if (brandPaletteDepth <= 0) {
        insideBrandPalette = false;
        brandPaletteDepth = 0;
      }
      return;
    }

    if (insideBrandPalette) {
      brandPaletteDepth += countBraceDelta(line);
      if (brandPaletteDepth <= 0) {
        insideBrandPalette = false;
        brandPaletteDepth = 0;
      }
      return;
    }

    if (line.includes(BRAND_COMMENT)) return;
    count += line.match(COLOR_LITERAL_PATTERN)?.length ?? 0;
  });

  return count;
}

function formatTable(title, items, formatter) {
  console.log(`\n${title}`);
  if (items.length === 0) {
    console.log('  none');
    return;
  }
  items.forEach((item, index) => {
    console.log(formatter(item, index));
  });
}

const args = parseArgs(process.argv.slice(2));
const fileStats = [];

for (const filePath of walk(srcRoot.pathname)) {
  const relativePath = relative(studioRoot.pathname, filePath).replaceAll('\\', '/');
  const content = readFileSync(filePath, 'utf8');
  const lineCount = content.split('\n').length;

  fileStats.push({
    relativePath,
    inlineStyles: countMatches(content, INLINE_STYLE_PATTERN),
    colorLiterals: countColorLiterals(relativePath, content),
    lineCount,
    largeFile: lineCount > args.lineThreshold ? 1 : 0,
    zIndexCount: countMatches(content, Z_INDEX_PATTERN),
    importantCount: countMatches(content, IMPORTANT_PATTERN),
    typeBranches: countMatches(content, TYPE_BRANCH_PATTERN),
  });
}

const totals = fileStats.reduce((acc, file) => ({
  inlineStyles: acc.inlineStyles + file.inlineStyles,
  colorLiterals: acc.colorLiterals + file.colorLiterals,
  largeFiles: acc.largeFiles + file.largeFile,
  zIndexCount: acc.zIndexCount + file.zIndexCount,
  importantCount: acc.importantCount + file.importantCount,
  typeBranches: acc.typeBranches + file.typeBranches,
}), {
  inlineStyles: 0,
  colorLiterals: 0,
  largeFiles: 0,
  zIndexCount: 0,
  importantCount: 0,
  typeBranches: 0,
});

console.log('Studio visual debt audit');
console.log(`Scanned files: ${fileStats.length}`);
console.log(`Large file threshold: > ${args.lineThreshold} lines`);

formatTable(
  'Top inline style files',
  fileStats.filter((file) => file.inlineStyles > 0).sort((a, b) => b.inlineStyles - a.inlineStyles || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.inlineStyles}`,
);

formatTable(
  'Top color literal files',
  fileStats.filter((file) => file.colorLiterals > 0).sort((a, b) => b.colorLiterals - a.colorLiterals || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.colorLiterals}`,
);

formatTable(
  'Largest files',
  fileStats.sort((a, b) => b.lineCount - a.lineCount || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.lineCount} lines`,
);

formatTable(
  'Files with numeric z-index',
  fileStats.filter((file) => file.zIndexCount > 0).sort((a, b) => b.zIndexCount - a.zIndexCount || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.zIndexCount}`,
);

formatTable(
  'Files with !important',
  fileStats.filter((file) => file.importantCount > 0).sort((a, b) => b.importantCount - a.importantCount || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.importantCount}`,
);

formatTable(
  'Files with hardcoded widget type branches',
  fileStats.filter((file) => file.typeBranches > 0).sort((a, b) => b.typeBranches - a.typeBranches || a.relativePath.localeCompare(b.relativePath)).slice(0, args.top),
  (file, index) => `${String(index + 1).padStart(2, ' ')}. ${file.relativePath} - ${file.typeBranches}`,
);

console.log('\nTotals');
console.log(`- inline styles: ${totals.inlineStyles}`);
console.log(`- color literals: ${totals.colorLiterals}`);
console.log(`- files over threshold: ${totals.largeFiles}`);
console.log(`- numeric z-index uses: ${totals.zIndexCount}`);
console.log(`- !important uses: ${totals.importantCount}`);
console.log(`- hardcoded widget type branches: ${totals.typeBranches}`);

const failures = [];
for (const [key, max] of Object.entries(args.thresholds)) {
  if (!Number.isFinite(max)) continue;
  const actual = totals[key];
  if (typeof actual === 'number' && actual > max) {
    failures.push(`${key} ${actual} > ${max}`);
  }
}

if (failures.length > 0) {
  console.error('\nThreshold failures:');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
