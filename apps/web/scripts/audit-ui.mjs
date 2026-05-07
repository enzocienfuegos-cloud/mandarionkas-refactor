import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), 'src');
const PAGE_EXTENSIONS = new Set(['.ts', '.tsx']);

// Files where palette/raw HTML are intentionally allowed:
//   - system/ : the design system itself defines these patterns
//   - shell/ProductLauncher.tsx : intentional premium login screen with hex colors
const EXCLUDE_PATHS = [
  `${path.sep}system${path.sep}`,
  `${path.sep}shell${path.sep}ProductLauncher.tsx`,
  // Sidebar nav items use raw <button> intentionally:
  // they are link-style navigation, not Button primitive CTAs.
  // Button primitive's size/layout/wrapping fights the nav row layout.
  `${path.sep}shell${path.sep}Sidebar.tsx`,
];

const BUTTON_HEURISTIC_EXCLUDE_PATHS = [
  `${path.sep}pages-refactored${path.sep}`,
];

// Forbidden patterns. Each rule has a regex and a human message.
const FORBIDDEN = [
  {
    pattern: /\bdark:/g,
    msg: 'No dark: variants in pages — theme comes from DUSK tokens.',
  },
  {
    pattern: /bg-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g,
    msg: 'No raw Tailwind palette backgrounds — use tokens.',
  },
  {
    pattern: /text-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g,
    msg: 'No raw Tailwind palette text colors — use tokens.',
  },
  {
    pattern: /border-(slate|zinc|gray|fuchsia|amber|emerald|rose|sky|violet|indigo)-/g,
    msg: 'No raw Tailwind palette borders — use tokens.',
  },
  {
    pattern: /<h1[^>]*\bclassName="[^"]*\btext-(3xl|4xl|5xl|6xl|7xl)\b/g,
    msg: 'No marketing-style h1 — use <PageHeader title=... /> (text-xl).',
  },
  {
    pattern: /<button(\s|>)/g,
    msg: 'No raw <button> — use <Button> or <IconButton> primitive.',
  },
  {
    pattern: /<table(\s|>)/g,
    msg: 'No raw <table> — use <DataTable>.',
  },
  {
    pattern: /<input\s+(?:[^>]*\s)?(?:type="(?:text|search|email|url|tel|number|password)")?[^>]*placeholder=/g,
    msg: 'No raw <input> — use <Input> or <FormField> primitive.',
  },
  {
    pattern: /onChange=\{\s*\(\)\s*=>\s*undefined\s*\}/g,
    msg: 'No-op onChange — input is broken. Either wire handler or remove.',
  },
  {
    pattern: /onClick=\{\s*undefined\s*\}/g,
    msg: 'Decorative button — must have a real onClick or be removed.',
  },
  {
    pattern: /from\s+['"]lucide-react['"]/g,
    msg: 'Import icons from "../system/icons", not lucide-react directly.',
  },
  {
    pattern: /window\.confirm/g,
    msg: 'Use useConfirm() — never window.confirm.',
  },
];

const findings = [];

function shouldSkip(filePath) {
  return EXCLUDE_PATHS.some((needle) => filePath.includes(needle));
}

function shouldSkipButtonHeuristic(filePath) {
  return BUTTON_HEURISTIC_EXCLUDE_PATHS.some((needle) => filePath.includes(needle));
}

function auditDecorativeButtons(filePath, content) {
  if (shouldSkipButtonHeuristic(filePath)) return;
  const lines = content.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].includes('<Button')) continue;
    let end = Math.min(lines.length, index + 8);
    for (let cursor = index + 1; cursor < Math.min(lines.length, index + 8); cursor += 1) {
      if (lines[cursor].includes('<Button')) {
        end = cursor;
        break;
      }
    }
    const window = lines.slice(index, end).join('\n');
    if (/\bonClick\s*=/.test(window)) continue;
    if (/\bdisabled\b/.test(window)) continue;
    if (/\btype\s*=\s*"submit"/.test(window)) continue;
    if (/\bform\s*=/.test(window)) continue;
    if (/\basChild\b/.test(window)) continue;

    const before = lines.slice(Math.max(0, index - 4), index).join('\n');
    const after = lines.slice(index, index + 12).join('\n');
    const localWindow = lines.slice(Math.max(0, index - 1), index + 2).join('\n');
    const wrappedInRouterLink = (before.includes('<Link') && after.includes('</Link>'))
      || (localWindow.includes('<Link') && localWindow.includes('</Link>'));
    const wrappedInAnchor = (before.includes('<a ') && after.includes('</a>'))
      || (localWindow.includes('<a ') && localWindow.includes('</a>'));
    if (wrappedInRouterLink || wrappedInAnchor) continue;

    findings.push(`${path.relative(process.cwd(), filePath)}:${index + 1} — Decorative <Button> detected — likely missing onClick. If intentional (e.g. type="submit" inside form), use disabled/asChild/form or move the action into a wrapping link.`);
  }
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
        if (rule.validate && !rule.validate(match, content, nextPath)) continue;
        const index = match.index ?? 0;
        const line = content.slice(0, index).split('\n').length;
        findings.push(`${path.relative(process.cwd(), nextPath)}:${line} — ${rule.msg}`);
      }
    }

    auditDecorativeButtons(nextPath, content);
  }
}

walk(ROOT);

if (findings.length) {
  console.error(`UI audit failed (${findings.length} findings):\n`);
  console.error(findings.join('\n'));
  process.exit(1);
}

console.log('UI audit passed.');
