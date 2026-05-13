import { randomUUID } from 'node:crypto';
import { enqueueVideoTranscodeJob } from '../video-transcode-jobs.mjs';

export function trimText(value) {
  return String(value ?? '').trim();
}

export function normalizeLimit(limit, fallback = 100) {
  return Math.min(Math.max(Number(limit) || fallback, 1), 500);
}

export function normalizeOffset(offset) {
  return Math.max(Number(offset) || 0, 0);
}

export function normalizeSearch(search) {
  const value = trimText(search).toLowerCase();
  return value.length >= 2 ? value : '';
}

export function extractJsonObject(value, fallback = {}) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeRawClickUrl(value) {
  const raw = String(value ?? '').trim().replace(/^(https?):\/(?!\/)/i, '$1://');
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    if (parsed.pathname.includes('/v1/tags/tracker/') && parsed.searchParams.has('url')) {
      const dest = String(parsed.searchParams.get('url') || '').trim().replace(/^(https?):\/(?!\/)/i, '$1://');
      if (dest) {
        try {
          const validated = new URL(dest);
          if (validated.protocol === 'http:' || validated.protocol === 'https:') return validated.toString();
        } catch (_) {
          // Fall through to store the original raw URL if the extracted destination is invalid.
        }
      }
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return parsed.toString();
    return null;
  } catch (_) {
    return null;
  }
}

export function hasPublishedRenditionAsset(rendition) {
  return (
    trimText(rendition?.public_url).length > 0
    && Number(rendition?.size_bytes || 0) > 0
    && extractJsonObject(rendition?.metadata, {}).available === true
  );
}

export function latestVersionSelect() {
  return `
    SELECT DISTINCT ON (cv.creative_id)
      cv.id,
      cv.workspace_id,
      cv.creative_id,
      cv.version_number,
      cv.source_kind,
      cv.serving_format,
      cv.status,
      cv.public_url,
      cv.entry_path,
      cv.mime_type,
      cv.width,
      cv.height,
      cv.duration_ms,
      cv.file_size,
      cv.metadata,
      cv.created_by,
      cv.reviewed_by,
      cv.reviewed_at,
      cv.review_notes,
      cv.created_at,
      cv.updated_at
    FROM creative_versions cv
    WHERE cv.creative_id = c.id
    ORDER BY cv.creative_id, cv.version_number DESC, cv.created_at DESC
    LIMIT 1
  `;
}

export function normalizeCreativeStatus(status, fallback = 'draft') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'processing', 'pending_review', 'approved', 'rejected', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

export function normalizeBindingStatus(status, fallback = 'active') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

export function normalizeSourceKind(sourceKind, fallback = 'html5_zip') {
  const normalized = String(sourceKind || '').trim().toLowerCase();
  return ['legacy', 'studio_export', 'html5_zip', 'video_mp4', 'image_upload', 'native_upload', 'vast_wrapper'].includes(normalized)
    ? normalized
    : fallback;
}

export function inferCreativeType(sourceKind) {
  if (sourceKind === 'video_mp4' || sourceKind === 'vast_wrapper') return 'vast_video';
  if (sourceKind === 'native_upload') return 'native';
  if (sourceKind === 'image_upload') return 'image';
  return 'display';
}

export function inferServingFormat(sourceKind) {
  if (sourceKind === 'video_mp4' || sourceKind === 'vast_wrapper') return 'vast_video';
  if (sourceKind === 'native_upload') return 'native';
  if (sourceKind === 'image_upload') return 'display_image';
  return 'display_html';
}

export function inferArtifactKind(sourceKind) {
  if (sourceKind === 'video_mp4') return 'video_mp4';
  return 'source_zip';
}

export function normalizeHtmlEntryPath(value) {
  const normalized = trimText(value).replace(/^\/+/, '');
  if (!normalized || normalized.toLowerCase().endsWith('.zip')) return 'index.html';
  return normalized;
}

export function resolvePublishedHtml5PreviewUrl(publicUrl, mimeType, metadata = {}) {
  const sourceUrl = trimText(publicUrl);
  if (!sourceUrl) return null;
  const publishedPublicUrl = trimText(metadata?.html5Publish?.publicUrl || metadata?.publishJob?.publicUrl);
  if (publishedPublicUrl) return publishedPublicUrl;
  const normalizedMimeType = trimText(mimeType).toLowerCase();
  const normalizedUrl = sourceUrl.toLowerCase();
  if (normalizedMimeType === 'text/html' && normalizedUrl.endsWith('.html')) return sourceUrl;
  if (normalizedUrl.includes('/creative-versions/') && normalizedUrl.endsWith('.html')) return sourceUrl;
  return null;
}

export function buildAutoVideoOutputPlan({ storageKey, publicUrl }) {
  const safeStorageKey = String(storageKey || '').trim();
  const safePublicUrl = String(publicUrl || '').trim();
  const baseStorageKey = safeStorageKey.replace(/\.[^.]+$/, '');
  const basePublicUrl = safePublicUrl.replace(/\.[^.]+$/, '');
  const low = {
    storageKey: `${baseStorageKey}-low.mp4`,
    publicUrl: `${basePublicUrl}-low.mp4`,
    maxHeight: 480,
    videoBitrateKbps: 900,
  };
  const mid = {
    storageKey: `${baseStorageKey}-mid.mp4`,
    publicUrl: `${basePublicUrl}-mid.mp4`,
    maxHeight: 720,
    videoBitrateKbps: 1500,
  };
  const high = {
    storageKey: `${baseStorageKey}-high.mp4`,
    publicUrl: `${basePublicUrl}-high.mp4`,
    maxHeight: 1080,
    videoBitrateKbps: 2400,
  };
  const poster = {
    storageKey: `${baseStorageKey}-poster.jpg`,
    publicUrl: `${basePublicUrl}-poster.jpg`,
  };
  return {
    low,
    mid,
    high,
    '480p': low,
    '720p': mid,
    '1080p': high,
    poster,
  };
}

export function getVideoProfileOutputKey(label = '') {
  const normalized = String(label || '').trim().toLowerCase();
  if (normalized === '1080p' || normalized === 'high') return 'high';
  if (normalized === '720p' || normalized === 'mid') return 'mid';
  if (normalized === '480p' || normalized === 'low') return 'low';
  return normalized;
}

export function buildQueuedVideoProcessingMetadata(version = {}, ladderProfiles = [], outputPlan = {}) {
  const queuedAt = new Date().toISOString();
  const feasibleProfiles = ladderProfiles.filter((profile) => profile.transcodePossible);
  const renditionProcessing = ladderProfiles.map((profile) => {
    const key = String(profile.label || '').trim().toLowerCase();
    return {
      label: profile.label,
      status: profile.transcodePossible ? 'queued' : 'unavailable',
      available: false,
      queuedAt: profile.transcodePossible ? queuedAt : null,
      publicUrl: outputPlan[key]?.publicUrl ?? null,
      storageKey: outputPlan[key]?.storageKey ?? null,
      width: profile.width ?? null,
      height: profile.height ?? null,
      bitrateKbps: profile.bitrateKbps ?? null,
      reason: profile.transcodePossible ? null : (profile.reason ?? 'source_below_target_height'),
    };
  });
  return {
    ...(version.metadata || {}),
    videoProcessing: {
      source: {
        width: version.width ?? null,
        height: version.height ?? null,
        mimeType: version.mime_type ?? null,
        durationMs: version.duration_ms ?? null,
      },
      ffprobeAvailable: true,
      ffmpegAvailable: true,
      targetPlan: ladderProfiles,
      renditionProcessing,
      generatedCount: 1,
      noTargetsReason: feasibleProfiles.length === 0 ? 'source_below_minimum_ladder_size' : null,
      status: feasibleProfiles.length > 0 ? 'queued' : 'blocked',
      queuedAt: feasibleProfiles.length > 0 ? queuedAt : null,
      reason: feasibleProfiles.length > 0 ? null : 'source_below_minimum_ladder_size',
      mode: 'auto-on-publish',
    },
  };
}

export function normalizeVariantStatus(status, fallback = 'draft') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'active', 'paused', 'archived'].includes(normalized)
    ? normalized
    : fallback;
}

export function normalizeRenditionStatus(status, fallback = 'processing') {
  const normalized = String(status || '').trim().toLowerCase();
  return ['draft', 'queued', 'processing', 'active', 'paused', 'archived', 'failed', 'unavailable'].includes(normalized)
    ? normalized
    : fallback;
}

export function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric) : null;
}

export function buildVariantLabel(input = {}) {
  const explicit = String(input.label || '').trim();
  if (explicit) return explicit;
  return `${input.width}x${input.height}`;
}

export function estimateBitrateKbps(width, height) {
  const w = normalizePositiveInteger(width);
  const h = normalizePositiveInteger(height);
  if (!w || !h) return null;
  const pixels = w * h;
  if (pixels >= 1920 * 1080) return 5000;
  if (pixels >= 1280 * 720) return 2800;
  if (pixels >= 854 * 480) return 1400;
  return 800;
}

export function buildVideoLadderProfiles(version = {}) {
  const sourceWidth = normalizePositiveInteger(version.width) || 1280;
  const sourceHeight = normalizePositiveInteger(version.height) || 720;
  const aspectRatio = sourceWidth > 0 && sourceHeight > 0 ? sourceWidth / sourceHeight : 16 / 9;
  const candidates = [
    { label: '1080p', height: 1080, sortOrder: 10 },
    { label: '720p', height: 720, sortOrder: 20 },
    { label: '480p', height: 480, sortOrder: 30 },
  ];
  return candidates.map((candidate) => {
    const width = Math.max(2, Math.round((candidate.height * aspectRatio) / 2) * 2);
    const transcodePossible = candidate.height <= sourceHeight;
    return {
      label: candidate.label,
      width,
      height: candidate.height,
      bitrateKbps: estimateBitrateKbps(width, candidate.height),
      sortOrder: candidate.sortOrder,
      transcodePossible,
      reason: transcodePossible ? null : 'source_below_target_height',
    };
  });
}

export function buildVideoTargetProfiles(version = {}) {
  return buildVideoLadderProfiles(version).filter((profile) => profile.transcodePossible);
}

export { randomUUID, enqueueVideoTranscodeJob };
