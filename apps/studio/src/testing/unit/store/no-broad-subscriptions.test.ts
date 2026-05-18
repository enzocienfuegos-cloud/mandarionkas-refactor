import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const PATTERNS = [
  /useStudioStore\s*\(\s*\(\s*value\s*\)\s*=>\s*value\s*\)/,
  /useStudioStore\s*\(\s*\(\s*state\s*\)\s*=>\s*state\s*\)/,
  /useStudioStore\s*\(\s*\(\s*current\s*\)\s*=>\s*current\s*\)/,
  /useStudioStore\s*\(\s*\(\s*snapshot\s*\)\s*=>\s*snapshot\s*\)/,
  /useStudioStore\s*\(\s*\(\s*s\s*\)\s*=>\s*s\s*\)/,
];

function collectFiles(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'testing') continue;
      files.push(...collectFiles(fullPath));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.(ts|tsx)$/.test(entry.name)) continue;
    files.push(fullPath);
  }
  return files;
}

describe('no broad store subscriptions', () => {
  it('keeps production code off identity subscriptions', () => {
    const srcRoot = join(process.cwd(), 'src');
    const files = collectFiles(srcRoot)
      .filter((file) => !file.endsWith('use-studio-store.ts'));

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      if (PATTERNS.some((pattern) => pattern.test(content))) {
        offenders.push(file);
      }
    }

    expect(offenders).toEqual([]);
  });
});
