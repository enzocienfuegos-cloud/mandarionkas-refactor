/**
 * worker/src/server.mjs — SMX Studio Background Worker
 * Polls the `jobs` table and processes pending jobs.
 * Start: node src/server.mjs
 */
import 'dotenv/config';
import { createPool }   from '@smx/db/pool';
import { transcode }    from './lib/transcode.mjs';
import { dispatchWebhooks } from './lib/webhook-dispatcher.mjs';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_MS, 10) || 5_000;
const MAX_RETRIES      = 3;

const pool = createPool();

async function claimJob(client) {
  const { rows } = await client.query(`
    UPDATE jobs
    SET    status     = 'processing',
           started_at = NOW(),
           attempts   = attempts + 1
    WHERE  id = (
      SELECT id FROM jobs
      WHERE  status IN ('pending','failed')
        AND  attempts < $1
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `, [MAX_RETRIES]);
  return rows[0] ?? null;
}

async function finishJob(client, id, error = null) {
  if (error) {
    await client.query(`
      UPDATE jobs SET status = 'failed', error = $2, finished_at = NOW() WHERE id = $1
    `, [id, String(error)]);
  } else {
    await client.query(`
      UPDATE jobs SET status = 'done', error = NULL, finished_at = NOW() WHERE id = $1
    `, [id]);
  }
}

async function processJob(job) {
  console.log(`[worker] processing job ${job.id} type=${job.type}`);
  const payload = job.payload ?? {};

  switch (job.type) {
    case 'transcode': {
      const { inputPath, outputDir, creativeId } = payload;
      const renditions = await transcode(inputPath, outputDir);
      // Persist HLS manifest path back to the creative
      await pool.query(
        `UPDATE creatives SET hls_url = $2, status = 'active' WHERE id = $1`,
        [creativeId, renditions.masterPlaylist],
      );
      break;
    }

    case 'webhook': {
      const { webhookId, event, body } = payload;
      const { rows } = await pool.query(
        `SELECT url, secret FROM webhooks WHERE id = $1 AND active = TRUE`,
        [webhookId],
      );
      if (rows[0]) {
        await dispatchWebhooks([rows[0]], event, body);
      }
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
      console.error(`[worker] job ${job.id} failed:`, err.message);
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
  console.log(`\n⚙️  SMX Worker started (poll every ${POLL_INTERVAL_MS}ms)\n`);
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
