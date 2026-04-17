import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { executePostgresQuery, getPostgresSchemaName, withPostgresTransaction } from './postgres-client.mjs';

const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const migrationsDir = join(root, 'server/data/postgres-migrations');

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export function listPostgresMigrationFiles() {
  return readdirSync(migrationsDir)
    .filter((name) => name.endsWith('.sql'))
    .sort()
    .map((name) => ({
      id: name.replace(/\.sql$/i, ''),
      name,
      path: join(migrationsDir, name),
    }));
}

export function renderPostgresMigrationSql(filePath, schema = getPostgresSchemaName()) {
  const source = readFileSync(filePath, 'utf8');
  return source.replaceAll('__PG_SCHEMA__', quoteIdentifier(schema));
}

export function splitPostgresMigrationStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export async function ensurePostgresMigrationsTable(schema = getPostgresSchemaName()) {
  await executePostgresQuery(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(schema)}`);
  await executePostgresQuery(`
    CREATE TABLE IF NOT EXISTS ${quoteIdentifier(schema)}.schema_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )
  `);
}

export async function listAppliedPostgresMigrationIds(schema = getPostgresSchemaName()) {
  const result = await executePostgresQuery(
    `SELECT id FROM ${quoteIdentifier(schema)}.schema_migrations ORDER BY id ASC`
  );
  return new Set((result.rows ?? []).map((row) => String(row.id)));
}

export async function applyPostgresMigration(migration, schema = getPostgresSchemaName()) {
  const sql = renderPostgresMigrationSql(migration.path, schema);
  const statements = splitPostgresMigrationStatements(sql);
  await withPostgresTransaction(async (query) => {
    for (const statement of statements) {
      await query(statement);
    }
    await query(
      `INSERT INTO ${quoteIdentifier(schema)}.schema_migrations (id) VALUES ($1)`,
      [migration.id]
    );
  });
}

export async function runPostgresMigrations(schema = getPostgresSchemaName()) {
  const migrations = listPostgresMigrationFiles();
  if (!migrations.length) {
    return { schema, applied: [], pending: [] };
  }

  await ensurePostgresMigrationsTable(schema);
  const applied = await listAppliedPostgresMigrationIds(schema);
  const pending = migrations.filter((migration) => !applied.has(migration.id));

  for (const migration of pending) {
    await applyPostgresMigration(migration, schema);
  }

  return {
    schema,
    applied: pending.map((migration) => migration.id),
    pending: [],
  };
}
