import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { buildSnapshotPayload, writeSnapshotFile } from './platform-snapshot-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const { normalizeDb } = await import('../server/data/db-shape.mjs');
const { readDb } = await import('./postgres-snapshot-repository.mjs');
const { getRepositoryMetadata } = await import('../server/data/repository.mjs');

const outputPath = String(process.env.PLATFORM_SNAPSHOT_OUT || '').trim();

async function main() {
  const db = normalizeDb(await readDb());
  const payload = buildSnapshotPayload({ db, repository: getRepositoryMetadata() });
  if (!outputPath) {
    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
    return;
  }

  const targetPath = await writeSnapshotFile(outputPath, payload);
  console.log(JSON.stringify({
    ok: true,
    outputPath: targetPath,
    repository: payload.repository,
    summary: payload.summary,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
