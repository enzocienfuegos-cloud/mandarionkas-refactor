import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(process.cwd(), 'server');

function walk(dir) {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    const path = join(dir, entry);
    const stats = statSync(path);
    if (stats.isDirectory()) {
      files.push(...walk(path));
    } else if (stats.isFile()) {
      files.push(path);
    }
  }
  return files;
}

function relative(path) {
  return path.replace(`${process.cwd()}/`, '');
}

function importsOf(content) {
  return Array.from(content.matchAll(/from\s+['"]([^'"]+)['"]/g)).map((match) => match[1]);
}

describe('backend architecture guardrails', () => {
  const files = walk(ROOT).map((path) => ({
    path,
    relativePath: relative(path),
    content: readFileSync(path, 'utf8'),
  }));

  it('keeps services off direct repository implementations', () => {
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('server/services/')) return [];
      return importsOf(file.content)
        .filter((specifier) =>
          specifier === '../data/repository.mjs'
          || specifier.startsWith('../data/postgres-')
        )
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps server runtime off snapshot tooling modules', () => {
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('server/')) return [];
      return importsOf(file.content)
        .filter((specifier) =>
          specifier.includes('snapshot-repository')
          || specifier.startsWith('../../scripts/')
          || specifier.startsWith('../scripts/')
        )
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps services talking to contracts for persistence', () => {
    const persistenceAwareServices = new Set([
      'server/services/asset-admin-service.mjs',
      'server/services/asset-service.mjs',
      'server/services/audit-service.mjs',
      'server/services/auth-service.mjs',
      'server/services/client-service.mjs',
      'server/services/document-service.mjs',
      'server/services/project-service.mjs',
    ]);
    const offenders = files.flatMap((file) => {
      if (!persistenceAwareServices.has(file.relativePath)) return [];
      const specifiers = importsOf(file.content);
      const hasContractImport = specifiers.some((specifier) => specifier.startsWith('../contracts/'));
      return hasContractImport ? [] : [`${file.relativePath} has no contract import`];
    });
    expect(offenders).toEqual([]);
  });

  it('keeps mappers free of service and contract imports', () => {
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('server/data/mappers/')) return [];
      return importsOf(file.content)
        .filter((specifier) =>
          specifier.startsWith('../services/')
          || specifier.startsWith('../../services/')
          || specifier.startsWith('../contracts/')
          || specifier.startsWith('../../contracts/')
        )
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps contracts free of service imports', () => {
    const offenders = files.flatMap((file) => {
      if (!file.relativePath.startsWith('server/contracts/')) return [];
      return importsOf(file.content)
        .filter((specifier) => specifier.startsWith('../services/'))
        .map((specifier) => `${file.relativePath} -> ${specifier}`);
    });
    expect(offenders).toEqual([]);
  });
});
