#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');

const ALLOWED_INLINE_STYLE_FILES = new Set([
  'src/canvas/stage/components/StageWidget.tsx',
  'src/export/runtime/widget-mounter.ts',
]);

const HOT_PATH_TRANSITION_FILES = new Set([
  'src/shared/styles/stage.css',
  'src/shared/styles/stage-selection.css',
  'src/shared/styles/timeline.css',
  'src/shared/styles/timeline-interactions.css',
]);

const NON_COMPOSITEABLE_TRANSITION_PROPS = [
  'left',
  'top',
  'right',
  'bottom',
  'width',
  'height',
  'background-color',
  'background',
  'border-color',
  'border',
  'padding',
  'margin',
  'font-size',
  'box-shadow',
  'filter',
];

function collectFiles(dir, exts) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, exts));
      continue;
    }
    if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

const offenders = [];

const jsFiles = collectFiles(SRC_ROOT, ['.ts', '.tsx'])
  .map((file) => relative(ROOT, file))
  .filter((file) => !file.includes('/testing/'))
  .filter((file) => !ALLOWED_INLINE_STYLE_FILES.has(file));

for (const file of jsFiles) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (/subscribeDom/.test(content) && /\.style\.(left|top)\s*=/.test(content)) {
    offenders.push({ file, reason: 'inline style.left/top mutation in subscribeDom hot path — use transform: translate3d instead' });
  }
}

const cssFiles = collectFiles(SRC_ROOT, ['.css'])
  .map((file) => relative(ROOT, file));

for (const file of cssFiles) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  if (/will-change\s*:\s*(left|top|width|height)\b/i.test(content)) {
    offenders.push({ file, reason: 'will-change targets left/top/width/height — use will-change: transform instead' });
  }
}

for (const file of cssFiles) {
  if (!HOT_PATH_TRANSITION_FILES.has(file)) continue;
  const content = readFileSync(join(ROOT, file), 'utf8');
  const transitions = content.matchAll(/transition\s*:\s*([^;]+);/g);
  for (const match of transitions) {
    const value = match[1];
    for (const prop of NON_COMPOSITEABLE_TRANSITION_PROPS) {
      const escaped = prop.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[\\s,])${escaped}(\\s|,|$)`, 'i');
      if (regex.test(value)) {
        offenders.push({ file, reason: `transition includes non-compositeable property "${prop}"` });
        break;
      }
    }
  }
}

if (offenders.length) {
  console.error('❌ Layout thrashing patterns detected.');
  console.error('   These patterns cause layout reflow / paint per frame and hurt editor fluidity.');
  console.error('');
  offenders.forEach(({ file, reason }) => console.error(`  - ${file}: ${reason}`));
  process.exit(1);
}

console.log('✅ No layout thrashing patterns.');
