import React from 'react';
import { Badge } from '../../system';
import type {
  Creative,
  CreativeIngestion,
  CreativeVersion,
  VideoRendition,
} from '../catalog';
import type { LatestVersionMap, VideoRenditionState } from './types';
import { statusBadge } from './ui';

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export const VARIANT_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
] as Array<{ label: string; width: number; height: number }>;

function parseTimestamp(value: unknown) {
  const text = String(value || '').trim();
  if (!text) return null;
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getLatestProcessingTimestamp(processing: Record<string, any> | undefined) {
  const directTimestamps = [
    parseTimestamp(processing?.updatedAt),
    parseTimestamp(processing?.startedAt),
    parseTimestamp(processing?.queuedAt),
  ].filter((value): value is number => value != null);

  const renditionProcessing = Array.isArray(processing?.renditionProcessing)
    ? processing.renditionProcessing
    : [];
  const nestedTimestamps = renditionProcessing
    .flatMap((entry: any) => [
      parseTimestamp(entry?.updatedAt),
      parseTimestamp(entry?.startedAt),
      parseTimestamp(entry?.queuedAt),
    ])
    .filter((value): value is number => value != null);

  return [...directTimestamps, ...nestedTimestamps].sort((a, b) => b - a)[0] ?? null;
}

function estimateVideoProcessingPercent(videoProcessing: Record<string, any> | undefined) {
  const status = String(videoProcessing?.status ?? '').trim().toLowerCase();
  if (!['queued', 'processing'].includes(status)) return null;

  const startedAt = parseTimestamp(videoProcessing?.startedAt)
    ?? parseTimestamp(videoProcessing?.updatedAt)
    ?? parseTimestamp(videoProcessing?.queuedAt);
  if (!startedAt) {
    return status === 'processing' ? 18 : 8;
  }

  const elapsedMs = Math.max(0, Date.now() - startedAt);
  if (status === 'queued') {
    return Math.min(24, 8 + Math.round(elapsedMs / 1500));
  }
  if (elapsedMs < 4000) return Math.min(42, 24 + Math.round(elapsedMs / 250));
  if (elapsedMs < 14000) return Math.min(84, 42 + Math.round((elapsedMs - 4000) / 240));
  return Math.min(97, 84 + Math.round((elapsedMs - 14000) / 1200));
}

export function getCreativeVersionTranscodeStatus(creativeVersion: CreativeVersion | null | undefined) {
  const status = String((creativeVersion as any)?.transcodeStatus ?? '').trim().toLowerCase();
  return status || null;
}

function getCreativeVersionTranscodeJob(creativeVersion: CreativeVersion | null | undefined) {
  const job = (creativeVersion as any)?.transcodeJob;
  return job && typeof job === 'object' ? job as Record<string, any> : null;
}

function getCreativeVersionVideoProcessing(creativeVersion: CreativeVersion | null | undefined) {
  const metadata = (creativeVersion?.metadata as Record<string, any> | undefined) ?? {};
  return (metadata.videoProcessing as Record<string, any> | undefined) ?? {};
}

function deriveTranscodeProgress(
  renditions: VideoRendition[],
  transcodeStatus: string | null | undefined,
  sourceHeight: number | null | undefined,
): { message: string } | null {
  if (!transcodeStatus) return null;
  if (!['processing', 'pending', 'queued'].includes(String(transcodeStatus))) return null;

  const nonSource = renditions.filter((r) => !r.isSource && r.status !== 'unavailable');
  if (nonSource.length === 0) return null;

  const total = nonSource.length;
  const done = nonSource.filter((r) => r.status === 'active' || r.status === 'paused').length;
  const inProgress = nonSource.find((r) =>
    r.status === 'queued' || r.status === 'processing' || r.status === 'draft'
  );

  const src = Number(sourceHeight || 0);
  const secsPerProfile = src >= 2000 ? 90 : src >= 1000 ? 55 : 25;
  const remaining = (total - done) * secsPerProfile;
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const timeStr = mins > 0
    ? `~${mins}m ${secs}s remaining`
    : `~${secs}s remaining`;

  if (done === 0) {
    return {
      message: `Starting transcoding… ${timeStr}`,
    };
  }

  if (done < total) {
    const profileLabel = inProgress?.label ?? '';
    return {
      message: `Transcoding ${profileLabel} (${done} of ${total} done) — ${timeStr}`,
    };
  }

  return {
    message: 'Finishing up, almost done…',
  };
}

function isVideoProcessingStale(creativeVersion: CreativeVersion | null | undefined) {
  const transcodeStatus = getCreativeVersionTranscodeStatus(creativeVersion);
  if (['stalled', 'failed', 'no_job', 'blocked'].includes(String(transcodeStatus))) return true;
  if (['pending', 'queued', 'processing', 'done'].includes(String(transcodeStatus))) return false;

  const videoProcessing = getCreativeVersionVideoProcessing(creativeVersion);
  const status = String(videoProcessing?.status ?? '').trim().toLowerCase();
  if (!['queued', 'processing'].includes(status)) return false;

  const referenceAt = getLatestProcessingTimestamp(videoProcessing);
  if (!referenceAt) return false;

  const elapsedMs = Math.max(0, Date.now() - referenceAt);
  const nextRetryAt = parseTimestamp(videoProcessing?.nextRetryAt);
  if (nextRetryAt && nextRetryAt > Date.now()) return false;

  return elapsedMs >= 30 * 1000;
}

function isRenditionProcessingEntryStale(entry: Record<string, any> | undefined, creativeVersion: CreativeVersion | null | undefined) {
  const transcodeStatus = getCreativeVersionTranscodeStatus(creativeVersion);
  if (['processing', 'pending', 'queued', 'done'].includes(String(transcodeStatus))) return false;
  if (['stalled', 'failed', 'no_job'].includes(String(transcodeStatus))) return true;

  const status = String(entry?.status ?? '').trim().toLowerCase();
  if (!['queued', 'processing', 'draft'].includes(status)) return false;

  const referenceAt = [
    parseTimestamp(entry?.updatedAt),
    parseTimestamp(entry?.startedAt),
    parseTimestamp(entry?.queuedAt),
  ].filter((value): value is number => value != null).sort((a, b) => b - a)[0] ?? null;
  if (!referenceAt) return false;

  return Math.max(0, Date.now() - referenceAt) >= 30 * 1000;
}

export function shouldPollVideoRenditions(state: VideoRenditionState | null) {
  if (!state || state.loading || !state.version) return false;
  if (state.error && !state.loading) return false;
  if (state.awaitingPublish) return true;
  if (state.version.sourceKind !== 'video_mp4') return false;

  const transcodeStatus = getCreativeVersionTranscodeStatus(state.version);
  if (['pending', 'queued', 'processing'].includes(String(transcodeStatus))) return true;
  if (['done', 'failed', 'stalled', 'no_job', 'blocked'].includes(String(transcodeStatus))) return false;

  const metadata = (state.version.metadata as Record<string, any> | undefined) ?? {};
  const videoProcessing = (metadata.videoProcessing as Record<string, any> | undefined) ?? {};
  const topLevelStatus = String(videoProcessing.status ?? '').toLowerCase();
  if (['blocked', 'failed'].includes(topLevelStatus) || isVideoProcessingStale(state.version)) return false;
  const renditionProcessing = Array.isArray(videoProcessing.renditionProcessing)
    ? videoProcessing.renditionProcessing
    : [];
  const hasPendingRenditions = state.renditions.some(
    (rendition) => !rendition.isSource && ['queued', 'processing', 'draft'].includes(String(rendition.status ?? '').toLowerCase()),
  );
  const hasPendingProcessingEntries = renditionProcessing.some(
    (entry: any) => ['queued', 'processing', 'draft'].includes(String(entry?.status ?? '').toLowerCase()) || !entry?.available,
  );
  const autoQueuedWithoutCompletion = videoProcessing.mode === 'auto-on-publish' && !videoProcessing.completedAt;
  const onlySourceVisible = state.renditions.length <= 1;

  return hasPendingRenditions || hasPendingProcessingEntries || autoQueuedWithoutCompletion || onlySourceVisible;
}

function humanizeVideoProcessingReason(reason: string | null | undefined) {
  switch (String(reason || '').trim().toLowerCase()) {
    case 'transcoding_disabled':
      return 'Transcoding is disabled in the worker configuration.';
    case 'ffmpeg_missing':
      return 'The worker does not have ffmpeg available.';
    case 'r2_missing':
      return 'The worker is missing R2 upload configuration.';
    case 'missing_source_url':
      return 'The source video URL is missing, so the worker cannot transcode it.';
    default:
      return String(reason || '').trim();
  }
}

export function getVideoProcessingPanelSummary(
  creativeVersion: CreativeVersion | null | undefined,
  awaitingPublish: boolean,
  renditions: VideoRendition[] = [],
) {
  if (awaitingPublish) {
    return {
      tone: 'info' as const,
      title: 'Publishing in background',
      message: 'The creative is still being published. Renditions will appear after the publish job finishes.',
    };
  }

  const transcodeStatus = getCreativeVersionTranscodeStatus(creativeVersion);
  const transcodeJob = getCreativeVersionTranscodeJob(creativeVersion);
  const videoProcessing = getCreativeVersionVideoProcessing(creativeVersion);
  const status = String(videoProcessing?.status ?? '').trim().toLowerCase();
  const reasonText = humanizeVideoProcessingReason(videoProcessing?.reason);
  const nextRetryAt = String(videoProcessing?.nextRetryAt || '').trim();
  const progressPercent = estimateVideoProcessingPercent(videoProcessing);
  const stale = isVideoProcessingStale(creativeVersion);

  if (['pending', 'queued', 'processing'].includes(String(transcodeStatus))) {
    const sourceHeight = (creativeVersion as any)?.height ?? null;
    const realProgress = deriveTranscodeProgress(renditions, transcodeStatus, sourceHeight);
    if (transcodeStatus === 'queued' && nextRetryAt) {
      return {
        tone: 'info' as const,
        title: 'Transcoding in progress',
        message: `In progress (${progressPercent ?? 8}%). The worker will retry this job around ${nextRetryAt}.`,
      };
    }
    return {
      tone: 'info' as const,
      title: 'Transcoding in progress',
      message: realProgress
        ? realProgress.message
        : transcodeStatus === 'processing'
          ? `In progress (${progressPercent ?? 42}%). The worker is rendering the rendition ladder now.`
          : `In progress (${progressPercent ?? 8}%). The worker is preparing this job for transcoding.`,
    };
  }

  if (transcodeStatus === 'done') {
    return {
      tone: 'success' as const,
      title: 'Transcoding complete',
      message: 'The worker finished generating the rendition ladder for this video.',
    };
  }

  if (transcodeStatus === 'stalled') {
    return {
      tone: 'warning' as const,
      title: 'Transcoding stalled',
      message: 'No active transcode job is running. Use Regenerate renditions to retry.',
    };
  }

  if (transcodeStatus === 'failed') {
    return {
      tone: 'error' as const,
      title: 'Transcoding failed',
      message: String(transcodeJob?.errorMessage || reasonText || 'The worker failed to render the video ladder.'),
    };
  }

  if (transcodeStatus === 'blocked') {
    return {
      tone: 'warning' as const,
      title: 'Transcoding unavailable',
      message: 'Source resolution is below the minimum required for transcoding.',
    };
  }

  if (transcodeStatus === 'no_job') {
    return null;
  }

  if (stale) {
    return {
      tone: 'warning' as const,
      title: 'Transcoding stalled',
      message: 'No active transcode job is running right now. These renditions should be generated for this source video, but the job is no longer progressing. Use Regenerate renditions to retry.',
    };
  }

  if (status === 'blocked') {
    return {
      tone: 'warning' as const,
      title: 'Transcoding blocked',
      message: reasonText || 'The worker is not able to start transcoding for this video yet.',
    };
  }
  if (status === 'failed') {
    return {
      tone: 'error' as const,
      title: 'Transcoding failed',
      message: reasonText || 'The worker failed to render the video ladder.',
    };
  }
  if (status === 'queued') {
    return {
      tone: 'info' as const,
      title: 'Transcoding in progress',
      message: nextRetryAt
        ? `In progress (${progressPercent ?? 8}%). The worker will retry this job around ${nextRetryAt}.`
        : `In progress (${progressPercent ?? 8}%). The worker is preparing this job for transcoding.`,
    };
  }
  if (status === 'processing') {
    return {
      tone: 'info' as const,
      title: 'Transcoding in progress',
      message: `In progress (${progressPercent ?? 42}%). The worker is rendering the rendition ladder now.`,
    };
  }
  return null;
}

export function getRenditionProgressLabel(entry: any, creativeVersion: CreativeVersion | null | undefined) {
  if (entry?.available) return 'generated';
  const status = String(entry?.status ?? '').trim().toLowerCase();
  if (status === 'unavailable') return 'N/A';
  if (!['queued', 'processing', 'draft'].includes(status)) {
    return String(entry?.status ?? entry?.reason ?? 'failed');
  }
  if (isRenditionProcessingEntryStale(entry, creativeVersion)) {
    return 'Retry required';
  }

  const startedAt = parseTimestamp(entry?.startedAt)
    ?? parseTimestamp(entry?.updatedAt)
    ?? parseTimestamp(entry?.queuedAt);
  const elapsedMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const progressPercent = status === 'processing'
    ? Math.min(97, Math.max(24, 24 + Math.round(elapsedMs / 500)))
    : Math.min(24, Math.max(8, 8 + Math.round(elapsedMs / 1500)));
  return `In progress (${progressPercent}%)`;
}

export function getVideoRenditionToggleBlockedReason(rendition: VideoRendition, renditionReadyForToggle: boolean) {
  if (rendition.status === 'processing') return 'This rendition is currently processing.';
  if (rendition.status === 'failed') return 'This rendition failed to generate.';
  if (rendition.status === 'unavailable') return 'N/A. This rendition is not technically possible for the current source video.';
  if (!rendition.isSource && rendition.status !== 'active' && !renditionReadyForToggle) {
    return 'This rendition is still queued and has not been generated yet.';
  }
  return null;
}

export function getVideoRenditionStatusBadge(
  rendition: VideoRendition,
  processingEntry?: Record<string, any> | null,
  creativeVersion?: CreativeVersion | null,
) {
  const source: Record<string, any> = (processingEntry && !processingEntry.available)
    ? processingEntry
    : ((rendition.metadata && typeof rendition.metadata === 'object')
      ? { ...rendition, ...rendition.metadata }
      : { ...rendition });
  const normalizedStatus = String(source?.status || '').trim().toLowerCase();
  if (!['queued', 'processing', 'draft'].includes(normalizedStatus)) {
    return statusBadge(rendition.status);
  }
  if (isRenditionProcessingEntryStale(source, creativeVersion)) {
    return <Badge tone="warning">Stalled</Badge>;
  }

  const startedAt = parseTimestamp(source?.startedAt)
    ?? parseTimestamp(source?.updatedAt)
    ?? parseTimestamp(source?.queuedAt)
    ?? parseTimestamp(rendition.metadata?.startedAt)
    ?? parseTimestamp(rendition.metadata?.updatedAt)
    ?? parseTimestamp(rendition.metadata?.queuedAt);
  const elapsedMs = startedAt ? Math.max(0, Date.now() - startedAt) : 0;
  const progressPercent = normalizedStatus === 'processing'
    ? Math.min(97, Math.max(24, 24 + Math.round(elapsedMs / 500)))
    : Math.min(24, Math.max(8, 8 + Math.round(elapsedMs / 1500)));

  return <Badge tone="warning">In progress {progressPercent}%</Badge>;
}

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

export function estimateRemainingDuration(elapsedMs: number, progressPercent: number) {
  if (progressPercent <= 0 || progressPercent >= 100) return null;
  const estimatedTotalMs = (elapsedMs / progressPercent) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  return remainingMs;
}

export function estimateRegenerationFeedback(elapsedMs: number) {
  if (elapsedMs < 1200) {
    return {
      stageLabel: 'Preparing source video…',
      progressPercent: Math.min(18, 6 + Math.round((elapsedMs / 1200) * 12)),
    };
  }
  if (elapsedMs < 4000) {
    return {
      stageLabel: 'Analyzing source with ffprobe…',
      progressPercent: Math.min(38, 18 + Math.round(((elapsedMs - 1200) / 2800) * 20)),
    };
  }
  if (elapsedMs < 12000) {
    return {
      stageLabel: 'Transcoding renditions with FFmpeg…',
      progressPercent: Math.min(82, 38 + Math.round(((elapsedMs - 4000) / 8000) * 44)),
    };
  }
  if (elapsedMs < 20000) {
    return {
      stageLabel: 'Publishing rendition artifacts…',
      progressPercent: Math.min(94, 82 + Math.round(((elapsedMs - 12000) / 8000) * 12)),
    };
  }
  return {
    stageLabel: 'Finalizing rendition metadata…',
    progressPercent: 97,
  };
}

function getPublishJob(ingestion: CreativeIngestion | null | undefined) {
  const metadata = ingestion?.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const publishJob = (metadata as Record<string, unknown>).publishJob;
  return publishJob && typeof publishJob === 'object'
    ? publishJob as Record<string, unknown>
    : null;
}

export function getPublishStageLabel(stage: string | null | undefined, fallback = 'Publishing creative in background…') {
  switch (stage) {
    case 'queued':
      return 'Queued for worker pickup…';
    case 'starting':
      return 'Preparing background publish job…';
    case 'creating_catalog_record':
      return 'Creating creative and version records…';
    case 'publishing_html5_archive':
      return 'Publishing HTML5 assets…';
    case 'transcoding_video':
      return 'Transcoding video renditions with FFmpeg…';
    case 'finalizing_publication':
      return 'Saving rendition metadata and activating assets…';
    case 'completed':
      return 'Creative publish completed.';
    case 'failed':
      return 'Creative publish failed.';
    default:
      return fallback;
  }
}

export function findPendingIngestionForCreative(
  ingestionList: CreativeIngestion[],
  creative: Creative,
  version: CreativeVersion,
) {
  const normalizedCreativeName = String(creative.name ?? '').trim().toLowerCase();
  const matches = ingestionList.filter((ingestion) => {
    const requestedName = String((ingestion.metadata as Record<string, unknown> | undefined)?.requestedName ?? '')
      .trim()
      .toLowerCase();
    const filenameBase = String(ingestion.originalFilename ?? '')
      .replace(/\.[^.]+$/, '')
      .trim()
      .toLowerCase();
    return (
      ingestion.creativeVersionId === version.id
      || ingestion.creativeId === creative.id
      || (!!normalizedCreativeName && requestedName === normalizedCreativeName)
      || (!!normalizedCreativeName && filenameBase === normalizedCreativeName)
    );
  });

  return matches
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0] ?? null;
}

export function buildLatestVersionPatch(current: LatestVersionMap, nextVersions: LatestVersionMap) {
  const patch: LatestVersionMap = {};
  for (const [id, version] of Object.entries(nextVersions)) {
    if (String(current[id]?.status ?? '') === 'processing') {
      patch[id] = version;
    }
  }
  return patch;
}

export function getPendingPublishJob(ingestion: CreativeIngestion | null | undefined) {
  return getPublishJob(ingestion);
}
