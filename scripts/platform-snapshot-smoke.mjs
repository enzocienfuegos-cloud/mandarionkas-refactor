import { newDb } from 'pg-mem';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildSnapshotPayload, compareSnapshotPayloads, writeSnapshotFile } from './platform-snapshot-lib.mjs';

loadOptionalEnvFile();
process.env.PLATFORM_REPOSITORY_DRIVER = 'postgres';
process.env.PLATFORM_POSTGRES_SCHEMA = process.env.PLATFORM_POSTGRES_SCHEMA || 'public';

const db = newDb({
  autoCreateForeignKeyIndices: true,
});

db.public.registerFunction({
  name: 'version',
  returns: 'text',
  implementation: () => 'pg-mem snapshot smoke',
});

const { Pool } = db.adapters.createPg();
const pool = new Pool();

globalThis.__SMX_PLATFORM_PG_EXECUTE__ = (text, params = []) => pool.query(text, params);
globalThis.__SMX_PLATFORM_PG_TRANSACTION__ = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback((queryText, queryParams = []) => client.query(queryText, queryParams));
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const { runPostgresMigrations } = await import('../server/data/postgres-migrations.mjs');
const repository = await import('./postgres-snapshot-repository.mjs');
const { getRepositoryMetadata } = await import('../server/data/repository.mjs');
const { normalizeDb } = await import('../server/data/db-shape.mjs');
const { createDemoSeed } = await import('./demo-seed.mjs');

async function main() {
  await runPostgresMigrations(process.env.PLATFORM_POSTGRES_SCHEMA);
  const currentDb = normalizeDb(await repository.readDb());
  const seeded = currentDb.users.length || currentDb.clients.length ? currentDb : createDemoSeed();
  seeded.projects.unshift({
    id: 'proj_snapshot_smoke',
    name: 'Snapshot Smoke',
    updatedAt: new Date().toISOString(),
    clientId: seeded.clients[0]?.id || 'client_default',
    ownerUserId: seeded.users[0]?.id || 'usr_admin',
    ownerName: seeded.users[0]?.name || 'SMX Admin',
    accessScope: 'client',
    brandName: 'Smoke Brand',
    campaignName: 'Snapshot Smoke',
    canvasPresetId: 'custom',
    sceneCount: 1,
    widgetCount: 1,
  });
  seeded.projectStates.proj_snapshot_smoke = {
    document: {
      id: 'proj_snapshot_smoke',
      name: 'Snapshot Smoke',
      scenes: [{ id: 'scene_1', widgetIds: ['widget_1'] }],
      metadata: {
        platform: {
          accessScope: 'client',
        },
      },
    },
    ui: {
      activeProjectId: 'proj_snapshot_smoke',
    },
  };
  await repository.writeDb(normalizeDb(seeded));

  const roundTrip = normalizeDb(await repository.readDb());
  const repositoryMetadata = getRepositoryMetadata();
  const leftPayload = buildSnapshotPayload({ db: roundTrip, repository: repositoryMetadata });
  const rightPayload = buildSnapshotPayload({ db: roundTrip, repository: repositoryMetadata });
  const comparison = compareSnapshotPayloads(leftPayload, rightPayload);

  const tempDir = await mkdtemp(join(tmpdir(), 'platform-snapshot-smoke-'));
  const leftPath = await writeSnapshotFile(join(tempDir, 'left.json'), leftPayload);
  const rightPath = await writeSnapshotFile(join(tempDir, 'right.json'), rightPayload);

  console.log(JSON.stringify({
    ok: comparison.ok,
    repository: repositoryMetadata,
    output: {
      leftPath,
      rightPath,
    },
    summary: leftPayload.summary,
    comparison,
  }, null, 2));

  if (!comparison.ok) process.exitCode = 1;
}

main()
  .finally(async () => {
    await pool.end();
    delete globalThis.__SMX_PLATFORM_PG_EXECUTE__;
    delete globalThis.__SMX_PLATFORM_PG_TRANSACTION__;
  })
  .catch((error) => {
    console.error(JSON.stringify({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }, null, 2));
    process.exitCode = 1;
  });
