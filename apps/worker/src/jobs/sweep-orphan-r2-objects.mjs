import { DeleteObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getPool } from '@smx/db/src/pool.mjs';
import {
  deleteCreativeIngestionRows,
  pruneOrphanCreativeIngestions,
} from '@smx/db/src/maintenance.mjs';
import { getWorkerConnectionString } from '../db-connection.mjs';

function log(level, payload) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    service: 'smx-worker',
    job: 'sweep-orphan-r2-objects',
    ...payload,
  });
  level === 'error' ? console.error(line) : console.log(line);
}

const logInfo = (payload) => log('info', payload);
const logWarn = (payload) => log('warn', payload);
const logError = (payload) => log('error', payload);

function trimText(value) {
  return String(value ?? '').trim();
}

function getConnectionString(source = process.env) {
  return getWorkerConnectionString(source);
}

function isR2Configured(source = process.env) {
  return Boolean(
    trimText(source.R2_ENDPOINT)
    && trimText(source.R2_BUCKET)
    && trimText(source.R2_ACCESS_KEY_ID)
    && trimText(source.R2_SECRET_ACCESS_KEY)
  );
}

let cachedR2Client = null;
let cachedR2Key = '';

function getR2Client(source = process.env) {
  const cacheKey = `${source.R2_ENDPOINT}|${source.R2_ACCESS_KEY_ID}|${source.R2_BUCKET}`;
  if (cachedR2Client && cachedR2Key === cacheKey) return cachedR2Client;

  cachedR2Client = new S3Client({
    region: 'auto',
    endpoint: source.R2_ENDPOINT,
    credentials: {
      accessKeyId: source.R2_ACCESS_KEY_ID,
      secretAccessKey: source.R2_SECRET_ACCESS_KEY,
    },
  });
  cachedR2Key = cacheKey;
  return cachedR2Client;
}

function isMissingObjectError(error) {
  const statusCode = Number(error?.$metadata?.httpStatusCode || 0);
  return statusCode === 404
    || error?.name === 'NoSuchKey'
    || error?.name === 'NotFound'
    || error?.Code === 'NoSuchKey';
}

const defaultSweepDeps = {
  DeleteObjectCommand,
  getPool,
  getR2Client,
  pruneOrphanCreativeIngestions,
  deleteCreativeIngestionRows,
};

export async function runSweepOrphanR2ObjectsJob(source = process.env) {
  return runSweepOrphanR2ObjectsJobWithDeps(source, defaultSweepDeps);
}

export async function runSweepOrphanR2ObjectsJobWithDeps(source = process.env, deps = defaultSweepDeps) {
  const resolvedDeps = { ...defaultSweepDeps, ...(deps || {}) };
  const connectionString = getConnectionString(source);

  if (!connectionString) {
    logInfo({ status: 'skipped', reason: 'database_not_configured' });
    return {
      markedFailed: 0,
      pendingSweep: 0,
      sweptObjects: 0,
      missingObjects: 0,
      failedDeletes: 0,
      deletedRows: 0,
      skipped: true,
    };
  }

  const pool = resolvedDeps.getPool(connectionString);
  const client = await pool.connect();

  try {
    const pruneResult = await resolvedDeps.pruneOrphanCreativeIngestions(client);
    const pendingSweep = Array.isArray(pruneResult?.pendingR2Sweep)
      ? pruneResult.pendingR2Sweep
      : [];

    if (!pendingSweep.length) {
      const summary = {
        markedFailed: pruneResult?.markedFailed || 0,
        pendingSweep: 0,
        sweptObjects: 0,
        missingObjects: 0,
        failedDeletes: 0,
        deletedRows: 0,
        skipped: false,
      };
      logInfo({ status: 'completed', ...summary });
      return summary;
    }

    if (!isR2Configured(source)) {
      const summary = {
        markedFailed: pruneResult?.markedFailed || 0,
        pendingSweep: pendingSweep.length,
        sweptObjects: 0,
        missingObjects: 0,
        failedDeletes: pendingSweep.length,
        deletedRows: 0,
        skipped: false,
        r2Skipped: true,
        reason: 'r2_not_configured',
      };
      logWarn({ status: 'partial', ...summary });
      return summary;
    }

    const r2Client = resolvedDeps.getR2Client(source);
    const deletedIngestionIds = [];
    let sweptObjects = 0;
    let missingObjects = 0;
    let failedDeletes = 0;

    for (const row of pendingSweep) {
      const id = trimText(row?.id);
      const storageKey = trimText(row?.storage_key);
      if (!id || !storageKey) continue;

      try {
        await r2Client.send(new resolvedDeps.DeleteObjectCommand({
          Bucket: source.R2_BUCKET,
          Key: storageKey,
        }));
        sweptObjects += 1;
        deletedIngestionIds.push(id);
      } catch (error) {
        if (isMissingObjectError(error)) {
          missingObjects += 1;
          deletedIngestionIds.push(id);
          continue;
        }
        failedDeletes += 1;
        logError({
          event: 'r2_delete_failed',
          ingestionId: id,
          storageKey,
          message: error?.message,
          code: error?.name || error?.Code,
        });
      }
    }

    const deletedRows = await resolvedDeps.deleteCreativeIngestionRows(client, deletedIngestionIds);
    const summary = {
      markedFailed: pruneResult?.markedFailed || 0,
      pendingSweep: pendingSweep.length,
      sweptObjects,
      missingObjects,
      failedDeletes,
      deletedRows,
      skipped: false,
    };

    logInfo({ status: 'completed', ...summary });
    return summary;
  } finally {
    client.release();
  }
}
