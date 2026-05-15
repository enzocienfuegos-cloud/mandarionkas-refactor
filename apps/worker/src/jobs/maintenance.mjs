// apps/worker/src/jobs/maintenance.mjs
//
// S44: Added reconcileStalledVideoTranscodeJobs.
// S46: Added pruneFrequencyCapEvents.

import { getPool } from '@smx/db/src/pool.mjs';
import { runIdentityStitching } from '@smx/db/src/identity-stitching.mjs';
import { expirePendingUploadSessions, pruneOldDrafts, revokeExpiredSessions } from '@smx/db/src/maintenance.mjs';
import { reconcileStalledHtml5Publishes } from '@smx/db/src/creative-ingestion-reconciler.mjs';
import { reconcileStalledVideoTranscodeJobs } from '@smx/db/src/video-transcode-jobs.mjs';
import { pruneFrequencyCapEvents } from '@smx/db/src/frequency-cap.mjs';
import { getWorkerConnectionString } from '../db-connection.mjs';

function log(level, payload) {
  console[level === 'error' ? 'error' : 'log'](
    JSON.stringify({ level, time: new Date().toISOString(), service: 'smx-worker', job: 'maintenance', ...payload }),
  );
}
const logInfo  = (p) => log('info', p);
const logError = (p) => log('error', p);
let lastIdentityStitchAt = 0;

function readPositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getConnectionString(source = process.env) {
  return getWorkerConnectionString(source);
}

const defaultMaintenanceDeps = {
  getPool,
  expirePendingUploadSessions,
  revokeExpiredSessions,
  pruneOldDrafts,
  reconcileStalledHtml5Publishes,
  reconcileStalledVideoTranscodeJobs,
  pruneFrequencyCapEvents,
  runIdentityStitching,
};

export async function runMaintenanceJob(source = process.env) {
  return runMaintenanceJobWithDeps(source, defaultMaintenanceDeps);
}

export async function runMaintenanceJobWithDeps(source = process.env, deps = defaultMaintenanceDeps) {
  const resolvedDeps = { ...defaultMaintenanceDeps, ...(deps || {}) };
  const connectionString = getConnectionString(source);
  if (!connectionString) {
    logInfo({ status: 'skipped', reason: 'database_not_configured' });
    return {
      expiredUploadSessions: 0,
      revokedSessions: 0,
      prunedDrafts: 0,
      stalledTranscodes: 0,
      requeuedTranscodes: 0,
      exhaustedTranscodes: 0,
      stalledHtml5Publishes: 0,
      requeuedHtml5Publishes: 0,
      exhaustedHtml5Publishes: 0,
      prunedCapEvents: 0,
      stitchedEdges: 0,
      skipped: true,
    };
  }

  const pool   = resolvedDeps.getPool(connectionString);
  const client = await pool.connect();
  try {
    const retentionDays = Number.parseInt(String(source.DRAFT_RETENTION_DAYS || '30'), 10);

    // ── Platform housekeeping ──────────────────────────────────────────
    const expiredUploadSessions = await resolvedDeps.expirePendingUploadSessions(client);
    const revokedSessions       = await resolvedDeps.revokeExpiredSessions(client);
    const prunedDrafts          = await resolvedDeps.pruneOldDrafts(client, { retentionDays });

    // ── S44: Video transcode stall reconciliation ──────────────────────
    let stalledTranscodeResult = { stalled: 0, requeued: 0, exhausted: 0 };
    try {
      stalledTranscodeResult = await resolvedDeps.reconcileStalledVideoTranscodeJobs(client);
      if (stalledTranscodeResult.stalled > 0) {
        logInfo({
          event: 'transcode_reconciliation',
          stalled:   stalledTranscodeResult.stalled,
          requeued:  stalledTranscodeResult.requeued,
          exhausted: stalledTranscodeResult.exhausted,
        });
      }
    } catch (reconcileError) {
      logError({ event: 'transcode_reconciliation_error', message: reconcileError?.message });
    }

    let stalledHtml5Result = { stalled: 0, requeued: 0, exhausted: 0 };
    try {
      stalledHtml5Result = await resolvedDeps.reconcileStalledHtml5Publishes(client);
      if (stalledHtml5Result.stalled > 0) {
        logInfo({
          event: 'html5_publish_reconciliation',
          stalled:   stalledHtml5Result.stalled,
          requeued:  stalledHtml5Result.requeued,
          exhausted: stalledHtml5Result.exhausted,
        });
      }
    } catch (reconcileError) {
      logError({ event: 'html5_publish_reconciliation_error', message: reconcileError?.message });
    }

    // ── S46: Frequency cap events housekeeping ─────────────────────────
    // Purge events older than 30 days (cap windows are at most 7 days,
    // so 30 days retention is generous for audit purposes).
    let prunedCapEvents = 0;
    try {
      prunedCapEvents = await resolvedDeps.pruneFrequencyCapEvents(client, 30);
      if (prunedCapEvents > 0) {
        logInfo({ event: 'frequency_cap_pruned', rows: prunedCapEvents });
      }
    } catch (pruneError) {
      logError({ event: 'frequency_cap_prune_error', message: pruneError?.message });
    }

    let stitchedEdges = 0;
    try {
      const now = Date.now();
      const stitchIntervalMs = readPositiveInteger(source.IDENTITY_STITCH_INTERVAL_MS, 15 * 60 * 1000);
      if (lastIdentityStitchAt > 0 && now - lastIdentityStitchAt < stitchIntervalMs) {
        logInfo({
          event: 'identity_stitching_skipped',
          reason: 'throttled',
          nextEligibleInMs: stitchIntervalMs - (now - lastIdentityStitchAt),
        });
      } else {
        const { rows: activeWs } = await client.query(
          `SELECT DISTINCT workspace_id
           FROM impression_events
           WHERE timestamp > NOW() - INTERVAL '7 days'`,
        );
        const workspaceIds = activeWs.map((row) => row.workspace_id).filter(Boolean);
        if (workspaceIds.length > 0) {
          lastIdentityStitchAt = now;
          stitchedEdges = await resolvedDeps.runIdentityStitching(client, { workspaceIds });
          if (stitchedEdges > 0) {
            logInfo({ event: 'identity_stitching_completed', stitchedEdges, workspaceCount: workspaceIds.length });
          }
        }
      }
    } catch (stitchError) {
      logError({ event: 'identity_stitching_error', message: stitchError?.message });
    }

    const summary = {
      expiredUploadSessions,
      revokedSessions,
      prunedDrafts,
      stalledTranscodes:   stalledTranscodeResult.stalled,
      requeuedTranscodes:  stalledTranscodeResult.requeued,
      exhaustedTranscodes: stalledTranscodeResult.exhausted,
      stalledHtml5Publishes:   stalledHtml5Result.stalled,
      requeuedHtml5Publishes:  stalledHtml5Result.requeued,
      exhaustedHtml5Publishes: stalledHtml5Result.exhausted,
      prunedCapEvents,
      stitchedEdges,
      skipped: false,
    };

    logInfo({ status: 'completed', ...summary });
    return summary;

  } finally {
    client.release();
  }
}
