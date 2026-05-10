import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { getPostgresSchemaName } from '../server/data/postgres-client.mjs';
import { listPostgresMigrationFiles, runPostgresMigrations } from '../server/data/postgres-migrations.mjs';

loadOptionalEnvFile();
const schema = getPostgresSchemaName();

async function main() {
  const migrations = listPostgresMigrationFiles();
  if (!migrations.length) {
    console.log('[postgres-migrate] No migration files found.');
    return;
  }

  const result = await runPostgresMigrations(schema);
  if (!result.applied.length) {
    console.log(`[postgres-migrate] Schema "${schema}" is already up to date.`);
    return;
  }
  for (const migrationId of result.applied) {
    console.log(`[postgres-migrate] Applied ${migrationId}`);
  }
  console.log(`[postgres-migrate] Applied ${result.applied.length} migration(s) to schema "${schema}".`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[postgres-migrate] ${message}`);
  process.exit(1);
});
