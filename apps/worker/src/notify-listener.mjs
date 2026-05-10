// apps/worker/src/notify-listener.mjs
//
// Bridges PostgreSQL LISTEN/NOTIFY → pgboss job dispatch.
//
// Why a dedicated LISTEN client and not the pool:
//   pg-boss (and pg Pool) use short-lived connections that are checked in/out
//   per query. LISTEN requires a *persistent* connection — if you LISTEN on a
//   pooled connection and it gets recycled, the subscription is silently lost.
//   This module owns one long-lived pg.Client for the sole purpose of listening.
//
// Flow:
//   1. PostgreSQL trigger fires pg_notify('smx.transcode-video', creativeVersionId)
//      on INSERT into video_transcode_jobs WHERE status = 'pending'.
//   2. This listener receives the notification on the persistent client.
//   3. It calls sendTranscodeJob(creativeVersionId) → boss.send('smx.transcode-video').
//   4. pgboss wakes the worker handler via its own LISTEN/NOTIFY mechanism.
//
// Reconnection:
//   If the connection drops (network blip, DB restart, idle timeout), the listener
//   waits RECONNECT_DELAY_MS and re-establishes. Jobs inserted during the gap are
//   NOT lost — they sit in video_transcode_jobs with status='pending'. The
//   maintenance job reconciler (already in the worker) will pick them up on the
//   next heartbeat cycle as a safety net.

import pg from 'pg';
import { sendTranscodeJob } from './queue.mjs';

const CHANNEL = 'smx.transcode-video';
const RECONNECT_DELAY_MS = 5_000;

function log(level, payload) {
  const line = JSON.stringify({
    level,
    time: new Date().toISOString(),
    service: 'smx-worker',
    component: 'notify-listener',
    ...payload,
  });
  level === 'error' ? console.error(line) : console.log(line);
}

let client = null;
let stopped = false;
let reconnectTimer = null;

function getConnectionString(source = process.env) {
  return String(source.DATABASE_POOL_URL || source.DATABASE_URL || '').trim();
}

async function connect(source = process.env) {
  if (stopped) return;

  const connectionString = getConnectionString(source);
  if (!connectionString) {
    throw new Error('notify-listener: DATABASE_URL or DATABASE_POOL_URL is required');
  }

  const c = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
  });

  c.on('error', (err) => {
    log('error', { event: 'client_error', message: err?.message, stack: err?.stack });
    scheduleReconnect(source);
  });

  c.on('end', () => {
    if (!stopped) {
      log('warn', { event: 'client_disconnected', channel: CHANNEL });
      scheduleReconnect(source);
    }
  });

  c.on('notification', async (msg) => {
    if (msg.channel !== CHANNEL) return;

    const creativeVersionId = msg.payload;
    if (!creativeVersionId) {
      log('warn', { event: 'notify_empty_payload', channel: msg.channel });
      return;
    }

    try {
      const jobId = await sendTranscodeJob(creativeVersionId);
      log('info', {
        event: 'notify_bridge',
        channel: CHANNEL,
        creativeVersionId,
        pgbossJobId: jobId ?? null,
      });
    } catch (err) {
      log('error', {
        event: 'notify_bridge_error',
        channel: CHANNEL,
        creativeVersionId,
        message: err?.message,
      });
    }
  });

  await c.connect();
  await c.query(`LISTEN "${CHANNEL}"`);

  client = c;
  log('info', { event: 'listening', channel: CHANNEL });
}

function scheduleReconnect(source = process.env) {
  if (stopped) return;
  if (reconnectTimer) return;

  client = null;

  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    if (stopped) return;

    log('info', { event: 'reconnecting', channel: CHANNEL });
    try {
      await connect(source);
    } catch (err) {
      log('error', { event: 'reconnect_failed', message: err?.message });
      scheduleReconnect(source);
    }
  }, RECONNECT_DELAY_MS);
}

export async function startNotifyListener(source = process.env) {
  stopped = false;
  await connect(source);
}

export async function stopNotifyListener() {
  stopped = true;

  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }

  if (client) {
    try {
      await client.end();
    } catch {
      // Ignore errors on shutdown
    } finally {
      client = null;
    }
  }

  log('info', { event: 'stopped', channel: CHANNEL });
}
