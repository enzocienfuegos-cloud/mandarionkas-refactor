import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getPool } from './pool.mjs';

const DEFAULT_DIR = resolve(process.cwd(), 'packages/db/migrations');

export function listMigrationFiles(migrationsDir = DEFAULT_DIR) {
  return readdirSync(migrationsDir).filter((entry) => entry.endsWith('.sql')).sort();
}

export async function runMigrations({ connectionString, migrationsDir = DEFAULT_DIR } = {}) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to run migrations.');
  }

  const pool = getPool(connectionString);
  const client = await pool.connect();

  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        applied_at timestamptz not null default now()
      )
    `);

    const appliedRows = await client.query('select filename from schema_migrations');
    const applied = new Set(appliedRows.rows.map((row) => row.filename));
    const files = listMigrationFiles(migrationsDir);
    const executed = [];

    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = readFileSync(resolve(migrationsDir, file), 'utf8').trim();
      if (!sql) continue;
      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename) values ($1)', [file]);
        await client.query('commit');
        executed.push(file);
      } catch (error) {
        await client.query('rollback');
        throw new Error(`Migration failed for ${file}: ${error.message}`);
      }
    }

    return { files, executed };
  } finally {
    client.release();
  }
}
