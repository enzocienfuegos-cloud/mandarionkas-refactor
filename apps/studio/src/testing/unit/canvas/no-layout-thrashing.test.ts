import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function collectFiles(dir: string, exts: string[]): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'testing') continue;
      files.push(...collectFiles(full, exts));
      continue;
    }
    if (entry.isFile() && exts.some((ext) => entry.name.endsWith(ext))) {
      files.push(full);
    }
  }
  return files;
}

describe('no layout thrashing', () => {
  it('subscribeDom callbacks never mutate style.left or style.top in production editor code', () => {
    const srcRoot = join(process.cwd(), 'src');
    const tsFiles = collectFiles(srcRoot, ['.ts', '.tsx']);

    const offenders: string[] = [];
    for (const file of tsFiles) {
      const content = readFileSync(file, 'utf8');
      if (file.includes('/export/runtime/')) continue;
      if (file.includes('/testing/')) continue;
      if (/subscribeDom/.test(content) && /\.style\.(left|top)\s*=/.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('CSS files never use will-change: left/top/width/height', () => {
    const srcRoot = join(process.cwd(), 'src');
    const cssFiles = collectFiles(srcRoot, ['.css']);

    const offenders: string[] = [];
    for (const file of cssFiles) {
      const content = readFileSync(file, 'utf8');
      if (/will-change\s*:\s*(left|top|width|height)\b/i.test(content)) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
