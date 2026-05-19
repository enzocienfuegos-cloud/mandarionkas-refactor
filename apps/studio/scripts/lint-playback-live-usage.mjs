#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const SRC_ROOT = join(ROOT, 'src');
const ALLOWED_FILES = new Set([
  'src/hooks/use-playback-engine.ts',
  'src/canvas/stage/playhead-ref-context.tsx',
]);

const FORBIDDEN_PATTERNS = [
  { pattern: /\busePlaybackMsLive\b/, label: 'usePlaybackMsLive' },
  { pattern: /\buseWidgetPlayheadMs\b/, label: 'useWidgetPlayheadMs' },
  { pattern: /\busePlaybackMsVisual\b/, label: 'usePlaybackMsVisual (re-renderiza @ 60Hz)' },
  {
    pattern: /usePlaybackMsSampled\s*\([^,]+,\s*(\d+)\s*\)/,
    label: 'usePlaybackMsSampled with small interval',
    validateMatch: (match) => Number(match[1]) < 100,
  },
  { pattern: /useSyncExternalStore\s*\([^)]*subscribeDom/s, label: 'useSyncExternalStore(subscribeDom, ...)' },
  { pattern: /subscribeDom\s*\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*?set[A-Z]\w*/s, label: 'setState inside subscribeDom callback' },
  {
    pattern: /subscribeDom\s*\(\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\bengine\.seekScene\b/s,
    label: 'engine.seekScene inside subscribeDom callback',
  },
  {
    pattern: /subscribeDom\s*\(\s*engine\.seekScene\s*\)/s,
    label: 'seekScene as subscribeDom callback',
  },
];

function collectFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

const files = collectFiles(SRC_ROOT)
  .map((fullPath) => relative(ROOT, fullPath))
  .filter((file) => !file.includes('/testing/'))
  .filter((file) => !ALLOWED_FILES.has(file));

const offenders = [];
for (const file of files) {
  const content = readFileSync(join(ROOT, file), 'utf8');
  for (const { pattern, label, validateMatch } of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match && (!validateMatch || validateMatch(match))) {
      offenders.push({ file, label });
      break;
    }
  }
}

if (offenders.length) {
  console.error('❌ Prohibited playback-live patterns detected in production code.');
  console.error('   These patterns cause React components to re-render at playback speed.');
  console.error('   Use playbackEngine.subscribeDom + DOM mutation, or usePlaybackMsThrottled() instead.');
  offenders.forEach(({ file, label }) => console.error(`  - ${file}: matches "${label}"`));
  process.exit(1);
}

console.log('✅ No production usage of playback-live patterns.');
