import { newDb } from 'pg-mem';
import { loadOptionalEnvFile } from './load-optional-env.mjs';

loadOptionalEnvFile();
process.env.PLATFORM_REPOSITORY_DRIVER = 'postgres';
process.env.PLATFORM_POSTGRES_SCHEMA = process.env.PLATFORM_POSTGRES_SCHEMA || 'public';

const db = newDb({
  autoCreateForeignKeyIndices: true,
});

db.public.registerFunction({
  name: 'version',
  returns: 'text',
  implementation: () => 'pg-mem smoke',
});

const { Pool } = db.adapters.createPg();
const pool = new Pool();

globalThis.__SMX_PLATFORM_PG_EXECUTE__ = (text, params = []) => pool.query(text, params);
globalThis.__SMX_PLATFORM_PG_TRANSACTION__ = async (callback) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback((text, params = []) => client.query(text, params));
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
const { executePostgresQuery } = await import('../server/data/postgres-client.mjs');
const repository = await import('../server/data/repository.mjs');
const snapshotRepository = await import('./postgres-snapshot-repository.mjs');
const { normalizeDb } = await import('../server/data/db-shape.mjs');
const { createDemoSeed } = await import('./demo-seed.mjs');

async function main() {
  const migrationResult = await runPostgresMigrations(process.env.PLATFORM_POSTGRES_SCHEMA);
  const readiness = await repository.checkRepositoryReadiness();
  const migrationRows = await executePostgresQuery('SELECT id FROM "public".schema_migrations ORDER BY id ASC');
  let userTableProbe = null;
  let userTableProbeError = null;
  try {
    userTableProbe = await executePostgresQuery('SELECT COUNT(*) AS total FROM "public"."users"');
  } catch (error) {
    userTableProbeError = error instanceof Error ? error.message : String(error);
    throw Object.assign(error instanceof Error ? error : new Error(String(error)), {
      smokeContext: {
        migrationResult,
        readiness,
        migrationRows: migrationRows.rows,
        userTableProbeError,
      },
    });
  }
  const currentDb = normalizeDb(await snapshotRepository.readDb());
  const seeded = currentDb.users.length || currentDb.clients.length ? currentDb : createDemoSeed();

  const projectId = 'proj_smoke';
  const nextState = {
    document: {
      id: projectId,
      name: 'Smoke Project',
      metadata: {
        platform: {
          brandId: 'brand_smoke',
          brandName: 'Smoke Brand',
          campaignName: 'Smoke Campaign',
          accessScope: 'client',
        },
      },
      canvas: { presetId: 'custom' },
      scenes: [{ id: 'scene_1', widgetIds: ['widget_1', 'widget_2'] }],
    },
    ui: {
      activeProjectId: projectId,
    },
  };

  seeded.projects.unshift({
    id: projectId,
    name: 'Smoke Project',
    updatedAt: new Date().toISOString(),
    clientId: seeded.clients[0]?.id || 'client_default',
    ownerUserId: seeded.users[0]?.id || 'usr_admin',
    ownerName: seeded.users[0]?.name || 'SMX Admin',
    brandId: 'brand_smoke',
    brandName: 'Smoke Brand',
    campaignName: 'Smoke Campaign',
    accessScope: 'client',
    canvasPresetId: 'custom',
    sceneCount: 1,
    widgetCount: 2,
  });
  seeded.projectStates[projectId] = nextState;
  await snapshotRepository.writeDb(normalizeDb(seeded));
  const roundTrip = normalizeDb(await snapshotRepository.readDb());
  const smokeProject = roundTrip.projects.find((project) => project.id === projectId);

  const result = {
    ok: Boolean(smokeProject && roundTrip.projectStates[projectId]),
    migrationResult,
    readiness,
    migrationRows: migrationRows.rows,
    userTableProbe: userTableProbe.rows?.[0] ?? null,
    totals: {
      users: roundTrip.users.length,
      clients: roundTrip.clients.length,
      projects: roundTrip.projects.length,
    },
    smokeProject: smokeProject
      ? {
          id: smokeProject.id,
          name: smokeProject.name,
          clientId: smokeProject.clientId,
        }
      : null,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
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
      message: error.message,
      stack: error.stack,
      smokeContext: error.smokeContext ?? null,
    }, null, 2));
    process.exitCode = 1;
  });
