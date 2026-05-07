import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const PAGE_EXTENSIONS = new Set(['.ts', '.tsx']);
const EXCLUDE_PATHS = [
  `${path.sep}system${path.sep}`,
  `${path.sep}pages-refactored${path.sep}`,
  `${path.sep}shell${path.sep}ProductLauncher.tsx`,
];

const FORBIDDEN = [
  { pattern: /\bdark:/g, msg: 'No dark: variants in pages' },
  { pattern: /bg-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g, msg: 'No raw Tailwind palette backgrounds' },
  { pattern: /text-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g, msg: 'No raw Tailwind palette text colors' },
  { pattern: /border-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g, msg: 'No raw Tailwind palette border colors' },
  { pattern: /<table\s/g, msg: 'No raw <table> outside system' },
  { pattern: /window\.confirm/g, msg: 'Use useConfirm() instead of window.confirm' },
];

const findings = [];

function shouldSkip(filePath) {
  return EXCLUDE_PATHS.some((needle) => filePath.includes(needle));
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const nextPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(nextPath);
      continue;
    }
    if (!PAGE_EXTENSIONS.has(path.extname(nextPath))) continue;
    if (shouldSkip(nextPath)) continue;

    const content = fs.readFileSync(nextPath, 'utf8');
    for (const rule of FORBIDDEN) {
      const matches = [...content.matchAll(rule.pattern)];
      if (!matches.length) continue;
      for (const match of matches) {
        const index = match.index ?? 0;
        const line = content.slice(0, index).split('\n').length;
        findings.push(`${path.relative(process.cwd(), nextPath)}:${line} — ${rule.msg}`);
      }
    }
  }
}

walk(ROOT);

if (findings.length) {
  console.error('UI audit failed:\n');
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('UI audit passed.');
