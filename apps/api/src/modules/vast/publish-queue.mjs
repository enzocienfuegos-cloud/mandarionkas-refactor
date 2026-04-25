import { createJob } from '@smx/db';
import { listTagIdsByCreativeVersion } from '@smx/db/tags';

export async function enqueueStaticVastPublish(pool, {
  workspaceId,
  tagId,
  trigger = 'unknown',
  requestedSize = null,
  dspProfiles = ['', 'basis', 'illumin'],
  priority = 5,
} = {}) {
  if (!pool || !workspaceId || !tagId) return null;
  return createJob(pool, {
    queue: 'vast_delivery',
    type: 'vast_static_publish',
    priority,
    maxAttempts: 5,
    payload: {
      workspaceId,
      tagId,
      trigger,
      requestedSize,
      dspProfiles,
    },
  });
}

export async function enqueueStaticVastPublishForCreativeVersion(pool, {
  workspaceId,
  creativeVersionId,
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
      trigger,
      requestedSize,
      dspProfiles,
      priority,
    });
    if (job) jobs.push(job);
  }
  return jobs;
}
