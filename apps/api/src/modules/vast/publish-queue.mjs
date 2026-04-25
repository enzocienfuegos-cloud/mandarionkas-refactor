import { createJob, updateJob } from '@smx/db';
import { listTagIdsByCreativeVersion } from '@smx/db/tags';

function normalizeProfiles(profiles = []) {
  const values = Array.isArray(profiles) ? profiles : [];
  const seen = new Set();
  const normalized = [];
  for (const value of values) {
    const raw = String(value ?? '').trim();
    const profile = raw ? raw.toLowerCase() : '';
    const key = raw ? profile : '__default__';
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(profile);
  }
  return normalized;
}

function buildTriggerEvent(trigger, dspProfiles = [], requestedSize = null) {
  return {
    trigger,
    requestedSize,
    dspProfiles: normalizeProfiles(dspProfiles),
    queuedAt: new Date().toISOString(),
  };
}

async function findExistingStaticVastPublishJob(pool, { workspaceId, tagId } = {}) {
  if (!pool || !workspaceId || !tagId) return null;
  const { rows } = await pool.query(
    `SELECT *
       FROM jobs
      WHERE queue = 'vast_delivery'
        AND type = 'vast_static_publish'
        AND status IN ('pending', 'running')
        AND payload->>'workspaceId' = $1
        AND payload->>'tagId' = $2
      ORDER BY
        CASE status WHEN 'running' THEN 0 ELSE 1 END,
        created_at ASC
      LIMIT 1`,
    [String(workspaceId), String(tagId)],
  );
  return rows[0] ?? null;
}

export async function enqueueStaticVastPublish(pool, {
  workspaceId,
  tagId,
  baseUrl = '',
  trigger = 'unknown',
  requestedSize = null,
  dspProfiles = ['', 'basis', 'illumin'],
  priority = 5,
} = {}) {
  if (!pool || !workspaceId || !tagId) return null;
  const normalizedProfiles = normalizeProfiles(dspProfiles);
  const existing = await findExistingStaticVastPublishJob(pool, { workspaceId, tagId });
  if (existing) {
    const mergedProfiles = normalizeProfiles([
      ...(existing.payload?.dspProfiles ?? []),
      ...normalizedProfiles,
    ]);
    const triggerHistory = [
      ...(Array.isArray(existing.payload?.triggerHistory) ? existing.payload.triggerHistory : []),
      buildTriggerEvent(trigger, normalizedProfiles, requestedSize),
    ].slice(-10);
    return updateJob(pool, existing.id, {
      payload: {
        ...(existing.payload ?? {}),
        workspaceId,
        tagId,
        baseUrl: String(baseUrl || existing.payload?.baseUrl || '').trim(),
        trigger,
        requestedSize: requestedSize ?? existing.payload?.requestedSize ?? null,
        dspProfiles: mergedProfiles.length ? mergedProfiles : ['', 'basis', 'illumin'],
        triggerHistory,
      },
      priority: Math.max(Number(existing.priority ?? 0), Number(priority ?? 0)),
    });
  }
  return createJob(pool, {
    queue: 'vast_delivery',
    type: 'vast_static_publish',
    priority,
    maxAttempts: 5,
    payload: {
      workspaceId,
      tagId,
      baseUrl: String(baseUrl || '').trim(),
      trigger,
      requestedSize,
      dspProfiles: normalizedProfiles.length ? normalizedProfiles : ['', 'basis', 'illumin'],
      triggerHistory: [buildTriggerEvent(trigger, normalizedProfiles, requestedSize)],
    },
  });
}

export async function enqueueStaticVastPublishForCreativeVersion(pool, {
  workspaceId,
  creativeVersionId,
  baseUrl = '',
  trigger = 'creative_version_update',
  requestedSize = null,
  dspProfiles = ['', 'basis', 'illumin'],
  priority = 5,
} = {}) {
  if (!pool || !workspaceId || !creativeVersionId) return [];
  const tagIds = await listTagIdsByCreativeVersion(pool, workspaceId, creativeVersionId);
  const jobs = [];
  for (const tagId of tagIds) {
    const job = await enqueueStaticVastPublish(pool, {
      workspaceId,
      tagId,
      baseUrl,
      trigger,
      requestedSize,
      dspProfiles,
      priority,
    });
    if (job) jobs.push(job);
  }
  return jobs;
}
