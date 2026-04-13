import path from 'node:path';
import process from 'node:process';
import { getPool, closeAllPools } from '../src/pool.mjs';
import {
  applyLegacyImportPlan,
  buildLegacyImportPlan,
  loadLegacyDataset,
  verifyAssetObjects,
  writeImportReport,
  writeImportReportMarkdown,
} from '../src/legacy-import.mjs';

function parseArgs(argv) {
  const options = {
    dryRun: true,
    resetTarget: false,
    verifyAssets: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === '--source-dir' && next) {
      options.sourceDir = next;
      index += 1;
      continue;
    }
    if (arg === '--source-file' && next) {
      options.sourceFile = next;
      index += 1;
      continue;
    }
    if (arg === '--apply') {
      options.dryRun = false;
      continue;
    }
    if (arg === '--reset-target') {
      options.resetTarget = true;
      continue;
    }
    if (arg === '--verify-assets') {
      options.verifyAssets = true;
      continue;
    }
    if (arg === '--report-json' && next) {
      options.reportJson = next;
      index += 1;
      continue;
    }
    if (arg === '--report-md' && next) {
      options.reportMd = next;
      index += 1;
      continue;
    }
    if (arg === '--legacy-r2-data-key' && next) {
      options.legacyR2DataKey = next;
      index += 1;
      continue;
    }
    if (arg === '--legacy-r2-data-prefix' && next) {
      options.legacyR2DataPrefix = next;
      index += 1;
      continue;
    }
  }

  return options;
}

function envOr(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
}

function resolveLegacyR2Options(options) {
  const endpoint = envOr('LEGACY_R2_ENDPOINT', 'R2_ENDPOINT');
  const bucket = envOr('LEGACY_R2_BUCKET', 'R2_BUCKET');
  const accessKeyId = envOr('LEGACY_R2_ACCESS_KEY_ID', 'R2_ACCESS_KEY_ID');
  const secretAccessKey = envOr('LEGACY_R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY');
  const dataKey = options.legacyR2DataKey || envOr('LEGACY_PLATFORM_API_DATA_KEY', 'PLATFORM_API_DATA_KEY');
  const dataPrefix = options.legacyR2DataPrefix || envOr('LEGACY_PLATFORM_API_DATA_PREFIX', 'PLATFORM_API_DATA_PREFIX');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, dataKey, dataPrefix };
}

function resolveVerificationR2Options() {
  const endpoint = envOr('R2_ENDPOINT');
  const bucket = envOr('R2_BUCKET');
  const accessKeyId = envOr('R2_ACCESS_KEY_ID');
  const secretAccessKey = envOr('R2_SECRET_ACCESS_KEY');
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportJson = path.resolve(options.reportJson || 'artifacts/legacy-import-report.json');
  const reportMd = path.resolve(options.reportMd || 'artifacts/legacy-import-report.md');

  const legacySource = {
    sourceDir: options.sourceDir,
    sourceFile: options.sourceFile,
    r2: resolveLegacyR2Options(options),
  };

  const dataset = await loadLegacyDataset(legacySource);
  const plan = await buildLegacyImportPlan(dataset);

  if (options.verifyAssets) {
    plan.report.assetVerification = await verifyAssetObjects(plan.assets, resolveVerificationR2Options());
    if (plan.report.assetVerification.enabled && plan.report.assetVerification.missing > 0) {
      plan.report.warnings.push(`Asset verification found ${plan.report.assetVerification.missing} missing objects.`);
    }
  }

  await writeImportReport(reportJson, plan.report);
  await writeImportReportMarkdown(reportMd, plan.report);

  if (!options.dryRun) {
    const connectionString = envOr('DATABASE_URL');
    if (!connectionString) {
      throw new Error('DATABASE_URL is required when running with --apply.');
    }
    const pool = getPool(connectionString);
    const client = await pool.connect();
    try {
      await applyLegacyImportPlan(client, plan, { resetTarget: options.resetTarget, clearSessions: true });
    } finally {
      client.release();
    }
  }

  const mode = options.dryRun ? 'dry-run' : 'applied';
  console.log(`[legacy-import] ${mode}`);
  console.log(`[legacy-import] source users=${plan.report.sourceCounts.users} clients=${plan.report.sourceCounts.clients} projects=${plan.report.sourceCounts.projects} assets=${plan.report.sourceCounts.assets}`);
  console.log(`[legacy-import] target users=${plan.report.targetCounts.users} workspaces=${plan.report.targetCounts.workspaces} projects=${plan.report.targetCounts.projects} assets=${plan.report.targetCounts.assets}`);
  console.log(`[legacy-import] warnings=${plan.report.warnings.length} skipped_versions=${plan.report.skipped.projectVersionsWithoutState} drafts_collapsed=${plan.report.skipped.draftsCollapsed}`);
  console.log(`[legacy-import] report_json=${reportJson}`);
  console.log(`[legacy-import] report_md=${reportMd}`);
}

main()
  .catch((error) => {
    console.error('[legacy-import] failed');
    console.error(error && error.stack ? error.stack : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeAllPools();
  });
