/**
 * worker/src/server.mjs — SMX Studio Background Worker
 * Polls the `jobs` table and processes pending jobs.
 * Start: node src/server.mjs
 */
import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { createPool } from '@smx/db/pool';
import { getCreativeIngestion, updateCreativeIngestion } from '@smx/db';
import { dispatchWebhook } from './lib/webhook-dispatcher.mjs';
import { transcodeToHls } from './lib/transcode.mjs';
import {
  publishCreativeIngestionToCatalog,
} from '../../api/src/modules/creatives/creative-ingestion-publisher.mjs';
import { getConfiguredBaseUrl } from '../../api/src/modules/shared/request-base-url.mjs';
import { publishStaticVastArtifactsForTag } from '../../api/src/modules/vast/xml-delivery.mjs';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_MS, 10) || 5_000;
const WORKER_ID = process.env.WORKER_ID || `${process.env.HOSTNAME || 'worker'}-${randomUUID().slice(0, 8)}`;

const pool = createPool();

async function claimJob(client) {
  const { rows } = await client.query(`
    UPDATE jobs
    SET    status     = 'running',
           started_at = NOW(),
           attempts   = attempts + 1,
           worker_id  = $1,
           updated_at = NOW()
    WHERE  id = (
      SELECT id FROM jobs
      WHERE  status IN ('pending','failed')
        AND  attempts < max_attempts
        AND  run_at <= NOW()
      ORDER BY priority DESC, run_at ASC, created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `, [WORKER_ID]);
  return rows[0] ?? null;
}

async function finishJob(client, id, error = null) {
  if (error) {
    await client.query(`
      UPDATE jobs
      SET status = 'failed',
          error = $2,
          failed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [id, String(error)]);
  } else {
    await client.query(`
      UPDATE jobs
      SET status = 'completed',
          error = NULL,
          completed_at = NOW(),
          updated_at = NOW()
      WHERE id = $1
    `, [id]);
  }
}

function buildPublishJobState(currentMetadata = {}, patch = {}) {
  return {
    ...(currentMetadata?.publishJob ?? {}),
    ...patch,
  };
}

async function updatePublishProgress(workspaceId, ingestionId, patch = {}) {
  const ingestion = await getCreativeIngestion(pool, workspaceId, ingestionId);
  if (!ingestion) return null;
  return updateCreativeIngestion(pool, workspaceId, ingestionId, {
    ...(patch.status ? { status: patch.status } : {}),
    ...(patch.errorCode !== undefined ? { errorCode: patch.errorCode } : {}),
    ...(patch.errorDetail !== undefined ? { errorDetail: patch.errorDetail } : {}),
    metadata: {
      ...(ingestion.metadata ?? {}),
      publishJob: buildPublishJobState(ingestion.metadata, patch.publishJob ?? {}),
    },
  });
}

async function processJob(job) {
  console.log(`[worker] processing job ${job.id} type=${job.type}`);
  const payload = job.payload ?? {};

  switch (job.type) {
    case 'transcode': {
      const { inputPath, outputDir, creativeId } = payload;
      const renditions = await transcodeToHls({ inputPath, outputDir, creativeId });
      // Persist HLS manifest path back to the creative
      await pool.query(
        `UPDATE creatives SET hls_url = $2, status = 'active' WHERE id = $1`,
        [creativeId, renditions.masterPlaylist],
      );
      break;
    }

    case 'webhook': {
      const { webhookId, event, body } = payload;
      await dispatchWebhook(pool, webhookId, event, body);
      break;
    }

    case 'creative_ingestion_publish': {
      const {
        workspaceId,
        ingestionId,
        userId,
        requestedName = null,
        requireManualReview = false,
      } = payload;

      const ingestion = await getCreativeIngestion(pool, workspaceId, ingestionId);
      if (!ingestion) {
        throw new Error(`Creative ingestion ${ingestionId} not found`);
      }

      if (ingestion.status === 'published' && ingestion.creative_id && ingestion.creative_version_id) {
        await updatePublishProgress(workspaceId, ingestionId, {
          status: 'published',
          errorCode: null,
          errorDetail: null,
          publishJob: {
            jobId: job.id,
            status: 'completed',
            stage: 'completed',
            progressPercent: 100,
            message: 'Creative already published',
            completedAt: new Date().toISOString(),
          },
        });
        break;
      }

      await updatePublishProgress(workspaceId, ingestionId, {
        status: 'processing',
        errorCode: null,
        errorDetail: null,
        publishJob: {
          jobId: job.id,
          status: 'running',
          stage: 'starting',
          progressPercent: 10,
          message: 'Worker started publish job',
          startedAt: new Date().toISOString(),
          workerId: WORKER_ID,
        },
      });

      console.log(`[worker] publish job ${job.id} started ingestion=${ingestionId} workspace=${workspaceId} sourceKind=${ingestion.source_kind}`);
      const published = await publishCreativeIngestionToCatalog({
        pool,
        workspaceId,
        ingestion,
        requestedName,
        userId,
        requireManualReview,
        onStage: async ({ stage, progressPercent, message }) => {
          console.log(`[worker] publish job ${job.id} stage=${stage} progress=${progressPercent ?? '?'} message=${message ?? ''}`);
          await updatePublishProgress(workspaceId, ingestionId, {
            status: 'processing',
            publishJob: {
              jobId: job.id,
              status: 'running',
              stage,
              progressPercent,
              message,
              workerId: WORKER_ID,
            },
          });
        },
      });

      await updatePublishProgress(workspaceId, ingestionId, {
        status: 'published',
        errorCode: null,
        errorDetail: null,
        publishJob: {
          jobId: job.id,
          status: 'completed',
          stage: 'completed',
          progressPercent: 100,
          message: 'Creative published successfully',
          completedAt: new Date().toISOString(),
          workerId: WORKER_ID,
        },
      });

      console.log(
        `[worker] publish job ${job.id} completed creative=${published.creative.id} creativeVersion=${published.creativeVersion.id}`,
      );
      await updateCreativeIngestion(pool, workspaceId, ingestionId, {
        creativeId: published.creative.id,
        creativeVersionId: published.creativeVersion.id,
        status: 'published',
        errorCode: null,
        errorDetail: null,
        metadata: {
          ...((await getCreativeIngestion(pool, workspaceId, ingestionId))?.metadata ?? {}),
          catalogPublished: true,
          creativeId: published.creative.id,
          creativeVersionId: published.creativeVersion.id,
          html5Published: ingestion.source_kind === 'html5_zip',
          publishJob: {
            jobId: job.id,
            status: 'completed',
            stage: 'completed',
            progressPercent: 100,
            message: 'Creative published successfully',
            completedAt: new Date().toISOString(),
            workerId: WORKER_ID,
          },
        },
      });
      break;
    }

    case 'vast_static_publish': {
      const {
        workspaceId,
        tagId,
        trigger = 'queued_publish',
        requestedSize = null,
        dspProfiles = ['', 'basis', 'illumin'],
      } = payload;

      if (!workspaceId || !tagId) {
        throw new Error('Missing workspaceId or tagId for vast_static_publish');
      }

      const baseUrl = getConfiguredBaseUrl();
      console.log(`[worker] static vast publish job ${job.id} started tag=${tagId} workspace=${workspaceId} trigger=${trigger}`);
      const published = await publishStaticVastArtifactsForTag({
        pool,
        workspaceId,
        tagId,
        baseUrl,
        requestedSize,
        dspProfiles,
        trigger,
      });
      console.log(`[worker] static vast publish job ${job.id} completed tag=${tagId} profiles=${published.length}`);
      break;
    }

    default:
      throw new Error(`Unknown job type: ${job.type}`);
  }
}

async function poll() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const job = await claimJob(client);
    if (!job) {
      await client.query('ROLLBACK');
      return;
    }
    await client.query('COMMIT');

    try {
      await processJob(job);
      const c2 = await pool.connect();
      try { await finishJob(c2, job.id); }
      finally { c2.release(); }
    } catch (err) {
      console.error(`[worker] job ${job.id} failed:`, err.stack ?? err.message);
      if (job.type === 'creative_ingestion_publish') {
        const { workspaceId, ingestionId } = job.payload ?? {};
        if (workspaceId && ingestionId) {
          await updatePublishProgress(workspaceId, ingestionId, {
            status: 'failed',
            errorCode: 'publish_failed',
            errorDetail: err.message,
            publishJob: {
              jobId: job.id,
              status: 'failed',
              stage: 'failed',
              progressPercent: 100,
              message: err.message,
              failedAt: new Date().toISOString(),
              workerId: WORKER_ID,
            },
          });
        }
      }
      const c2 = await pool.connect();
      try { await finishJob(c2, job.id, err.message); }
      finally { c2.release(); }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[worker] poll error:', err.message);
  } finally {
    client.release();
  }
}

async function run() {
  console.log(`\n⚙️  SMX Worker started (poll every ${POLL_INTERVAL_MS}ms) id=${WORKER_ID}\n`);
  // Verify DB connection
  try { await pool.query('SELECT 1'); }
  catch (err) { console.error('[worker] DB connection failed:', err.message); process.exit(1); }

  // eslint-disable-next-line no-constant-condition
  while (true) {
    await poll();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

run().catch(err => {
  console.error('[worker] fatal:', err);
  process.exit(1);
});
