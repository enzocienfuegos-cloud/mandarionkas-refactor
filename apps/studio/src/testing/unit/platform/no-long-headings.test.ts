import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function walk(dirPath: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dirPath)) {
    const fullPath = join(dirPath, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      files.push(...walk(fullPath));
      continue;
    }
    if (fullPath.endsWith('.tsx')) files.push(fullPath);
  }
  return files;
}

describe('headings are scannable', () => {
  it('keeps static h1 and h2 copy under six words in platform and shell surfaces', () => {
    const roots = [
      'src/platform',
      'src/app/shell',
    ];
    const offenders: string[] = [];

    roots.flatMap((root) => walk(root)).forEach((file) => {
      const src = readFileSync(file, 'utf8');
      const matches = src.matchAll(/<(h[12])>([^<{]+)<\/\1>/g);
      for (const match of matches) {
        const words = match[2].trim().split(/\s+/).filter(Boolean).length;
        if (words > 5) {
          offenders.push(`${file}: "${match[2].trim()}" (${words} words)`);
        }
      }
    });

    expect(offenders).toEqual([]);
  });
});
