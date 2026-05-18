import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

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

function collectUseStudioStoreCalls(content: string): string[] {
  const calls: string[] = [];
  let searchIndex = 0;

  while (searchIndex < content.length) {
    const callStart = content.indexOf('useStudioStore', searchIndex);
    if (callStart === -1) break;
    const openParen = content.indexOf('(', callStart);
    if (openParen === -1) break;

    let depth = 0;
    let inSingle = false;
    let inDouble = false;
    let inTemplate = false;
    let inLineComment = false;
    let inBlockComment = false;
    let closeIndex = -1;

    for (let index = openParen; index < content.length; index += 1) {
      const char = content[index];
      const next = content[index + 1];
      const prev = content[index - 1];

      if (inLineComment) {
        if (char === '\n') inLineComment = false;
        continue;
      }

      if (inBlockComment) {
        if (prev === '*' && char === '/') inBlockComment = false;
        continue;
      }

      if (!inSingle && !inDouble && !inTemplate) {
        if (char === '/' && next === '/') {
          inLineComment = true;
          index += 1;
          continue;
        }
        if (char === '/' && next === '*') {
          inBlockComment = true;
          index += 1;
          continue;
        }
      }

      if (!inDouble && !inTemplate && char === '\'' && prev !== '\\') {
        inSingle = !inSingle;
        continue;
      }
      if (!inSingle && !inTemplate && char === '"' && prev !== '\\') {
        inDouble = !inDouble;
        continue;
      }
      if (!inSingle && !inDouble && char === '`' && prev !== '\\') {
        inTemplate = !inTemplate;
        continue;
      }

      if (inSingle || inDouble || inTemplate) continue;

      if (char === '(') {
        depth += 1;
        continue;
      }
      if (char === ')') {
        depth -= 1;
        if (depth === 0) {
          closeIndex = index;
          break;
        }
      }
    }

    if (closeIndex === -1) break;
    calls.push(content.slice(callStart, closeIndex + 1));
    searchIndex = closeIndex + 1;
  }

  return calls;
}

function returnsObjectLiteral(call: string): boolean {
  return /useStudioStore\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\(\s*\{/.test(call)
    || /useStudioStore\s*\(\s*\(\s*\w+\s*\)\s*=>\s*\{[\s\S]*?\breturn\s*\{/.test(call);
}

describe('no playhead-coupled snapshots', () => {
  it('keeps playheadMs out of shared shallowEqual snapshots', () => {
    const srcRoot = join(process.cwd(), 'src');
    const files = collectFiles(srcRoot)
      .filter((file) => !file.endsWith('use-studio-store.ts'));

    const offenders: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, 'utf8');
      const calls = collectUseStudioStoreCalls(content);
      for (const call of calls) {
        if (returnsObjectLiteral(call) && call.includes('shallowEqual') && call.includes('playheadMs')) {
          offenders.push(file);
          break;
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
