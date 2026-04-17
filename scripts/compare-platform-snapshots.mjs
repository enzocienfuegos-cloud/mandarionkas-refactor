import { loadOptionalEnvFile } from './load-optional-env.mjs';
import { compareSnapshotPayloads, loadSnapshotFile } from './platform-snapshot-lib.mjs';

loadOptionalEnvFile('.env');
loadOptionalEnvFile('.env.staging');

const leftPath = String(process.argv[2] || process.env.PLATFORM_SNAPSHOT_LEFT || '').trim();
const rightPath = String(process.argv[3] || process.env.PLATFORM_SNAPSHOT_RIGHT || '').trim();

if (!leftPath || !rightPath) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Usage: node scripts/compare-platform-snapshots.mjs <left.json> <right.json>',
  }, null, 2));
  process.exit(1);
}

async function main() {
  const [left, right] = await Promise.all([loadSnapshotFile(leftPath), loadSnapshotFile(rightPath)]);
  const comparison = compareSnapshotPayloads(left.parsed, right.parsed);

  const result = {
    ok: comparison.ok,
    left: {
      path: left.absolutePath,
      repository: left.parsed.repository || null,
      summary: left.parsed.summary || {},
    },
    right: {
      path: right.absolutePath,
      repository: right.parsed.repository || null,
      summary: right.parsed.summary || {},
    },
    summaryDiffs: comparison.summaryDiffs,
    identityDiffs: comparison.identityDiffs,
  };

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    message: error instanceof Error ? error.message : String(error),
  }, null, 2));
  process.exit(1);
});
