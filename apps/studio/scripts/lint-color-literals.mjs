import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const studioRoot = new URL('..', import.meta.url);
const srcRoot = new URL('../src', import.meta.url);

const OPT_IN_MARKER = 'render-tokenized';
const RGBA_PATTERNS = [
  /rgba\(\s*255\s*,\s*255\s*,\s*255/i,
  /rgba\(\s*0\s*,\s*0\s*,\s*0/i,
];
const HEX_PATTERN = /#[0-9a-fA-F]{3,8}\b/g;
const BRAND_COMMENT = '// brand:';
const BRAND_PALETTE_DECLARATION = /BrandPalette\s*=\s*{/;
const ALLOWED_FILE_SUFFIXES = ['.tsx'];
const ALLOWED_EXACT_FILES = new Set([
  'src/widgets/modules/export-renderers.ts',
]);

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist') continue;
      yield* walk(full);
      continue;
    }
    if (ALLOWED_FILE_SUFFIXES.some((suffix) => entry.endsWith(suffix))) {
      yield full;
    }
  }
}

function countBraceDelta(line) {
  const opens = (line.match(/{/g) ?? []).length;
  const closes = (line.match(/}/g) ?? []).length;
  return opens - closes;
}

function shouldScanFile(relativePath, content) {
  if (ALLOWED_EXACT_FILES.has(relativePath)) return false;
  return content.includes(OPT_IN_MARKER);
}

let violations = 0;

for (const file of walk(srcRoot.pathname)) {
  const relativePath = relative(studioRoot.pathname, file).replaceAll('\\', '/');
  const content = readFileSync(file, 'utf8');
  if (!shouldScanFile(relativePath, content)) continue;

  const lines = content.split('\n');
  let insideBrandPalette = false;
  let brandPaletteDepth = 0;

  lines.forEach((line, index) => {
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

    for (const pattern of RGBA_PATTERNS) {
      if (pattern.test(line)) {
        console.error(`${relativePath}:${index + 1}: forbidden generic rgba literal: ${line.trim()}`);
        violations += 1;
        return;
      }
    }

    const hexMatches = line.match(HEX_PATTERN);
    if (hexMatches) {
      console.error(`${relativePath}:${index + 1}: forbidden hex literal outside BrandPalette: ${line.trim()}`);
      violations += hexMatches.length;
    }
  });
}

if (violations > 0) {
  console.error(`\n${violations} color-literal violation(s) found. Use theme tokens, a *BrandPalette block, or // brand: annotations.`);
  process.exit(1);
}
