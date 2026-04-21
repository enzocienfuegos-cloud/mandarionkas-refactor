#!/usr/bin/env node
/**
 * migrate.mjs — Run all pending SQL migrations in order.
 *
 * Usage:
 *   node scripts/migrate.mjs
 *   DATABASE_URL=postgres://... node scripts/migrate.mjs
 *
 * Creates a `schema_migrations` table to track which files have run.
 * Safe to run multiple times — already-applied migrations are skipped.
 */

import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join, dirname }     from 'node:path';
import { fileURLToPath }     from 'node:url';
import pg                    from 'pg';

const { Client } = pg;
const __dirname  = dirname(fileURLToPath(import.meta.url));

const MIGRATIONS_DIR = join(__dirname, '../packages/db/migrations');

// ── Bootstrap migration tracking table ────────────────────────────────────────

const BOOTSTRAP_SQL = `
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename    TEXT        PRIMARY KEY,
    applied_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );
`;

// ── Run ───────────────────────────────────────────────────────────────────────

async function run() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('ERROR: DATABASE_URL is not set.');
    process.exit(1);
  }

  const client = new Client({ connectionString: connStr });
  await client.connect();
  console.log('Connected to database.\n');

  try {
    // Ensure migrations table exists
    await client.query(BOOTSTRAP_SQL);

    // Discover migration files
    let files;
    try {
      files = await readdir(MIGRATIONS_DIR);
    } catch {
      console.error(`ERROR: migrations directory not found: ${MIGRATIONS_DIR}`);
      console.error('Make sure all sprint packages/db/migrations/* files are assembled.');
      process.exit(1);
    }

    const sqlFiles = files
      .filter(f => f.endsWith('.sql'))
      .sort();                   // lexicographic = 0001 → 0030

    if (!sqlFiles.length) {
      console.log('No migration files found.');
      return;
    }

    // Fetch already-applied migrations
    const { rows: applied } = await client.query(
      'SELECT filename FROM schema_migrations',
    );
    const appliedSet = new Set(applied.map(r => r.filename));

    let ran = 0;
    for (const filename of sqlFiles) {
      if (appliedSet.has(filename)) {
        console.log(`  skip  ${filename}`);
        continue;
      }

      const sql = await readFile(join(MIGRATIONS_DIR, filename), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query(
          'INSERT INTO schema_migrations (filename) VALUES ($1)',
          [filename],
        );
        await client.query('COMMIT');
        console.log(`  ✓     ${filename}`);
        ran++;
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`\n  ✗     ${filename}`);
        console.error(`        ${err.message}\n`);
        process.exit(1);
      }
    }

    if (ran === 0) {
      console.log('\nAll migrations already applied — nothing to do.');
    } else {
      console.log(`\n✓  Applied ${ran} migration${ran === 1 ? '' : 's'}.`);
    }
  } finally {
    await client.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
