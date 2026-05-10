#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const DRY_RUN = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

const REPLACEMENTS = [
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/db\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/db/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/config\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/config/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/r2\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/r2/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/contracts\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/contracts/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/db\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/db/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/config\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/config/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/\.\.\/packages\/r2\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/r2/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/packages\/db\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/db/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/\.\.\/packages\/config\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/config/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/packages\/db\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/db/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/packages\/config\/src\/([^'"]+)['"]/g,
    replace: (_, subpath) => `'@smx/config/src/${subpath}'`,
  },
  {
    pattern: /['"]\.\.\/\.\.\/\.\.\/api\/src\/lib\/logger\.mjs['"]/g,
    replace: () => '\'@smx/api/src/lib/logger.mjs\'',
  },
];

const TARGET_DIRS = [
  join(ROOT, 'apps', 'api', 'src'),
  join(ROOT, 'apps', 'worker', 'src'),
];

async function findMjsFiles(dir) {
  const results = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = join(current, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        await walk(full);
      } else if (entry.isFile() && entry.name.endsWith('.mjs')) {
        results.push(full);
      }
    }
  }
  await walk(dir);
  return results;
}

function migrateContent(content) {
  let updated = content;
  const changes = [];

  for (const { pattern, replace } of REPLACEMENTS) {
    pattern.lastIndex = 0;
    updated = updated.replace(pattern, (match, ...args) => {
      const replacement = replace(...args);
      if (replacement !== match) {
        changes.push({ from: match, to: replacement });
      }
      return replacement;
    });
  }

  return { updated, changes, modified: updated !== content };
}

const DEEP_IMPORT_PATTERN = /from ['"](\.\.\/)+(packages\/[^'"]+)['"]/g;

function findRemainingDeepImports(content, filePath) {
  const issues = [];
  DEEP_IMPORT_PATTERN.lastIndex = 0;
  let match;
  while ((match = DEEP_IMPORT_PATTERN.exec(content)) !== null) {
    issues.push({ file: filePath, import: match[0] });
  }
  return issues;
}

async function main() {
  const allFiles = [];
  for (const dir of TARGET_DIRS) {
    allFiles.push(...(await findMjsFiles(dir)));
  }

  let totalModified = 0;
  let totalChanges = 0;
  const issues = [];

  for (const filePath of allFiles) {
    const content = await readFile(filePath, 'utf8');
    const { updated, changes, modified } = migrateContent(content);

    if (VERIFY) {
      issues.push(...findRemainingDeepImports(modified ? updated : content, filePath));
    }

    if (!modified) continue;
    totalModified += 1;
    totalChanges += changes.length;

    if (!DRY_RUN) {
      await writeFile(filePath, updated, 'utf8');
    }
  }

  console.log(`Modified: ${totalModified} files`);
  console.log(`Changes: ${totalChanges} import statements`);

  if (VERIFY) {
    if (issues.length === 0) {
      console.log('✅ Verification passed — no deep relative imports remaining.');
      return;
    }
    console.log(`❌ Verification failed — ${issues.length} deep relative imports still found.`);
    for (const issue of issues) {
      console.log(`${issue.file.replace(ROOT + '/', '')}: ${issue.import}`);
    }
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
