import { checkPostgresRateLimit } from '../../../lib/rate-limit.mjs';

function trimText(value) {
  return String(value ?? '').trim();
}

function normalizePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getCreativeUploadRateLimitConfig(env = {}) {
  return {
    limit: normalizePositiveInteger(env.uploadRateLimitMax, 20),
    windowMs: normalizePositiveInteger(env.uploadRateLimitWindowMs, 60_000),
  };
}

export async function checkCreativeUploadRateLimit({
  client,
  env,
  headers,
  userId,
  workspaceId,
  checkRateLimit = checkPostgresRateLimit,
} = {}) {
  const { limit, windowMs } = getCreativeUploadRateLimitConfig(env);
  const safeUserId = trimText(userId) || 'anonymous-user';
  const safeWorkspaceId = trimText(workspaceId) || 'unknown-workspace';

  return checkRateLimit(client, {
    headers,
    key: `creative-upload:${safeUserId}:${safeWorkspaceId}`,
    limit,
    windowMs,
  });
}
