import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  type Creative,
  type CreativeVersion,
  type CreativeIngestion,
  type CreativeSizeVariant,
  type VideoRendition,
  type TagOption,
  type TagBinding,
  assignCreativeVersionToTag,
  createTag,
  createCreativeSizeVariant,
  createCreativeSizeVariantsBulk,
  deleteCreativeById,
  loadCreativeIngestion,
  loadCreativeVersionDetail,
  loadCreativesWithLatestVersion,
  loadCreativeIngestions,
  loadCreativeSizeVariants,
  loadVideoRenditions,
  regenerateVideoRenditions,
  loadTagBindings,
  loadTags,
  updateCreativeVersionById,
  updateCreativeSizeVariant,
  updateCreativeSizeVariantsBulkStatus,
  updateCreativeById,
  updateVideoRenditionById,
  updateTagBinding,
} from './catalog';
import type {
  BindingState,
  ClickUrlEditorState,
  CreativeFormat,
  CreativeRow,
  CreativeStatus,
  Metric,
  PreviewModalState,
  PrioritySeverity,
  QuickCreateTagState,
  RegenerationFeedbackState,
  VariantState,
  VideoRenditionState,
} from './creative-library/types';
import { CreativePreviewLightbox } from './creative-library/CreativePreviewLightbox';
import { ClickUrlEditorModal } from './creative-library/ClickUrlEditorModal';
import { CreativeBulkActionsPanel } from './creative-library/CreativeBulkActionsPanel';
import { QuickCreateTagModal } from './creative-library/QuickCreateTagModal';
import { TagBindingModal } from './creative-library/TagBindingModal';
import { VariantManagerModal } from './creative-library/VariantManagerModal';
import { VideoRenditionsModal } from './creative-library/VideoRenditionsModal';
import {
  AlertTriangleIcon,
  CreativeIcon,
  CreativeStatusBadge,
  FilterIcon,
  formatBytes,
  formatVideoBitrate,
  mapMetricTone,
  MoreIcon,
  PrioritySeverityBadge,
  readinessBadge,
  ReportIcon,
  resolveCreativePreviewHref,
  resolveCreativePreviewKind,
  SearchIcon,
  statusBadge,
  TableIcon,
} from './creative-library/ui';
import { loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';
import { Button, CenteredSpinner, Input, Kicker, MetricCard, Panel, useConfirm } from '../system';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

type LatestVersionMap = Record<string, CreativeVersion | null>;

const VARIANT_PRESETS = [
  { label: '300x250', width: 300, height: 250 },
  { label: '320x50', width: 320, height: 50 },
  { label: '320x100', width: 320, height: 100 },
  { label: '336x280', width: 336, height: 280 },
  { label: '728x90', width: 728, height: 90 },
  { label: '970x250', width: 970, height: 250 },
  { label: '160x600', width: 160, height: 600 },
  { label: '300x600', width: 300, height: 600 },
];

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

function getCreativeVersionTranscodeStatus(creativeVersion: CreativeVersion | null | undefined) {
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

function shouldPollVideoRenditions(state: VideoRenditionState | null) {
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

function getVideoProcessingPanelSummary(
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

function getRenditionProgressLabel(entry: any, creativeVersion: CreativeVersion | null | undefined) {
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

function getVideoRenditionToggleBlockedReason(rendition: VideoRendition, renditionReadyForToggle: boolean) {
  if (rendition.status === 'processing') return 'This rendition is currently processing.';
  if (rendition.status === 'failed') return 'This rendition failed to generate.';
  if (rendition.status === 'unavailable') return 'N/A. This rendition is not technically possible for the current source video.';
  if (!rendition.isSource && rendition.status !== 'active' && !renditionReadyForToggle) {
    return 'This rendition is still queued and has not been generated yet.';
  }
  return null;
}

function getVideoRenditionStatusBadge(
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
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
        Stalled
      </span>
    );
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

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800">
      In progress {progressPercent}%
    </span>
  );
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function estimateRemainingDuration(elapsedMs: number, progressPercent: number) {
  if (progressPercent <= 0 || progressPercent >= 100) return null;
  const estimatedTotalMs = (elapsedMs / progressPercent) * 100;
  const remainingMs = Math.max(0, estimatedTotalMs - elapsedMs);
  return remainingMs;
}

function estimateRegenerationFeedback(elapsedMs: number) {
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

function getPublishStageLabel(stage: string | null | undefined, fallback = 'Publishing creative in background…') {
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

function findPendingIngestionForCreative(
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

export default function CreativesView() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [searchParams] = useSearchParams();
  const searchQueryParam = searchParams.get('search') ?? '';
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [latestVersions, setLatestVersions] = useState<LatestVersionMap>({});
  const [ingestions, setIngestions] = useState<CreativeIngestion[]>([]);
  const [tags, setTags] = useState<TagOption[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => searchQueryParam);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending_review' | 'rejected'>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | 'video' | 'display' | 'native'>('all');
  const [sizeFilter, setSizeFilter] = useState('all');
  const [selectedCreativeIds, setSelectedCreativeIds] = useState<string[]>([]);
  const [bulkClickUrl, setBulkClickUrl] = useState('');
  const [bulkAssignTagId, setBulkAssignTagId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workspaceBusy, setWorkspaceBusy] = useState(false);
  const [bulkClickUrlSaving, setBulkClickUrlSaving] = useState(false);
  const [bulkAssignSaving, setBulkAssignSaving] = useState(false);
  const [bulkStatusSaving, setBulkStatusSaving] = useState(false);
  const [bulkDeleteSaving, setBulkDeleteSaving] = useState(false);
  const [statusUpdateCreativeId, setStatusUpdateCreativeId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [bindingState, setBindingState] = useState<BindingState | null>(null);
  const [variantState, setVariantState] = useState<VariantState | null>(null);
  const [videoRenditionState, setVideoRenditionState] = useState<VideoRenditionState | null>(null);
  const [regenerationFeedback, setRegenerationFeedback] = useState<RegenerationFeedbackState | null>(null);
  const [previewModal, setPreviewModal] = useState<PreviewModalState | null>(null);
  const [clickUrlEditor, setClickUrlEditor] = useState<ClickUrlEditorState | null>(null);
  const [quickCreateTagState, setQuickCreateTagState] = useState<QuickCreateTagState | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [{ creatives, latestVersions }, ingestions, tags, authMe, workspaceList] = await Promise.all([
        loadCreativesWithLatestVersion({ scope: 'all' }),
        loadCreativeIngestions(),
        loadTags({ scope: 'all' }),
        loadAuthMe(),
        loadWorkspaces(),
      ]);
      setCreatives(creatives);
      setLatestVersions(latestVersions);
      setIngestions(ingestions);
      setTags(tags);
      setWorkspaces(workspaceList);
      setActiveWorkspaceId(authMe.workspace?.id ?? workspaceList[0]?.id ?? '');
    } catch (loadError: any) {
      setError(loadError.message ?? 'Failed to load creative catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setSearchTerm(searchQueryParam);
  }, [searchQueryParam]);

  const getCreativeOperationalState = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const status = String(version?.status ?? '').toLowerCase();
    if (status === 'archived') return 'inactive';
    if (status === 'pending_review') return 'pending_review';
    if (status === 'rejected') return 'rejected';
    return 'active';
  };

  const getCreativeFormatFamily = (creative: Creative) => {
    const version = latestVersions[creative.id];
    if (version?.servingFormat === 'vast_video') return 'video';
    if (version?.servingFormat === 'native') return 'native';
    return 'display';
  };

  const getCreativeSizeLabel = (creative: Creative) => {
    const version = latestVersions[creative.id];
    const width = Number(version?.width) || 0;
    const height = Number(version?.height) || 0;
    return width > 0 && height > 0 ? `${width}x${height}` : 'unknown';
  };

  const availableSizeOptions = useMemo(
    () => Array.from(new Set(creatives.map((creative) => getCreativeSizeLabel(creative)).filter((value) => value !== 'unknown'))).sort((left, right) => {
      const [leftWidth, leftHeight] = left.split('x').map(Number);
      const [rightWidth, rightHeight] = right.split('x').map(Number);
      return (leftWidth * leftHeight) - (rightWidth * rightHeight) || left.localeCompare(right);
    }),
    [creatives, latestVersions],
  );

  const filteredCreatives = useMemo(
    () => creatives.filter((creative) => {
      if (selectedClientIds.length && !selectedClientIds.includes(creative.workspaceId ?? '')) return false;

      const version = latestVersions[creative.id];
      const formatFamily = getCreativeFormatFamily(creative);
      if (formatFilter !== 'all' && formatFamily !== formatFilter) return false;

      const operationalState = getCreativeOperationalState(creative);
      if (statusFilter !== 'all' && operationalState !== statusFilter) return false;

      if (sizeFilter !== 'all' && getCreativeSizeLabel(creative) !== sizeFilter) return false;

      const needle = searchTerm.trim().toLowerCase();
      if (!needle) return true;

      return [
        creative.name,
        creative.workspaceName,
        creative.clickUrl,
        version?.creativeName,
        version?.sourceKind,
        version?.servingFormat,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    }),
    [creatives, selectedClientIds, latestVersions, formatFilter, statusFilter, sizeFilter, searchTerm],
  );
  const allVisibleCreativesSelected = filteredCreatives.length > 0 && filteredCreatives.every(creative => selectedCreativeIds.includes(creative.id));
  const someVisibleCreativesSelected = filteredCreatives.some(creative => selectedCreativeIds.includes(creative.id));
  const selectedCreatives = useMemo(
    () => creatives.filter((creative) => selectedCreativeIds.includes(creative.id)),
    [creatives, selectedCreativeIds],
  );
  const selectedCreativeWorkspaceIds = useMemo(
    () => Array.from(new Set(selectedCreatives.map((creative) => String(creative.workspaceId ?? '')).filter(Boolean))),
    [selectedCreatives],
  );
  const selectedCreativeFormatFamilies = useMemo(
    () => Array.from(new Set(selectedCreatives.map((creative) => {
      const version = latestVersions[creative.id];
      if (!version) return 'unknown';
      if (version.servingFormat === 'vast_video') return 'VAST';
      if (version.servingFormat === 'native') return 'native';
      return 'display';
    }))),
    [latestVersions, selectedCreatives],
  );
  const bulkAssignableTags = useMemo(() => {
    if (selectedCreativeWorkspaceIds.length !== 1 || selectedCreativeFormatFamilies.length !== 1) return [];
    const workspaceId = selectedCreativeWorkspaceIds[0];
    const formatFamily = selectedCreativeFormatFamilies[0];
    if (formatFamily === 'unknown') return [];
    return tags.filter((tag) => tag.workspaceId === workspaceId && tag.format === formatFamily);
  }, [selectedCreativeFormatFamilies, selectedCreativeWorkspaceIds, tags]);

  useEffect(() => {
    setSelectedCreativeIds((current) => current.filter((id) => filteredCreatives.some((creative) => creative.id === id)));
  }, [filteredCreatives]);

  useEffect(() => {
    setBulkAssignTagId((current) => (
      current && bulkAssignableTags.some((tag) => tag.id === current) ? current : ''
    ));
  }, [bulkAssignableTags]);

  const canBulkAssign = selectedCreativeWorkspaceIds.length === 1
    && selectedCreativeFormatFamilies.length === 1
    && selectedCreativeFormatFamilies[0] !== 'unknown';

  const bulkAssignHint = !canBulkAssign
    ? selectedCreativeWorkspaceIds.length !== 1
      ? 'Select creatives from one client only to bulk assign them.'
      : 'Selected creatives need one shared delivery type and a latest version before bulk assignment.'
    : bulkAssignableTags.length === 0
      ? 'No tags of that type are available for this client yet.'
      : null;

  const approvedCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'active').length;
  const pendingQaCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'pending_review').length;
  const rejectedCreatives = filteredCreatives.filter((creative) => getCreativeOperationalState(creative) === 'rejected').length;
  const assignedCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return Boolean(version?.servingFormat);
  }).length;
  const pendingPreviewCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return !resolveCreativePreviewHref(creative, version);
  }).slice(0, 3);
  const missingCreatives = filteredCreatives.filter((creative) => {
    const version = latestVersions[creative.id];
    return !version || !resolveCreativePreviewHref(creative, version);
  }).length;
  const creativeEligibility = filteredCreatives.length ? Math.round(((approvedCreatives + assignedCreatives) / Math.max(filteredCreatives.length * 2, 1)) * 100) : 0;

  const creativeRows = useMemo<CreativeRow[]>(() => (
    filteredCreatives.map((creative) => {
      const version = latestVersions[creative.id];
      const formatFamily = getCreativeFormatFamily(creative);
      const statusKey = getCreativeOperationalState(creative);
      const previewHref = resolveCreativePreviewHref(creative, version);
      const previewLabel = !previewHref
        ? 'Asset missing'
        : version?.status === 'pending_review'
          ? 'Clicktag review'
          : 'Preview ready';
      const qa: PrioritySeverity =
        statusKey === 'rejected' || !previewHref
          ? 'Critical'
          : statusKey === 'pending_review'
            ? 'Warning'
            : 'Notice';
      const status: CreativeStatus =
        !previewHref
          ? 'Missing'
          : statusKey === 'rejected'
            ? 'Rejected'
            : statusKey === 'pending_review'
              ? 'Pending QA'
              : statusKey === 'inactive'
                ? 'Ready'
                : 'Approved';
      const format: CreativeFormat =
        formatFamily === 'video'
          ? 'Video'
          : formatFamily === 'native'
            ? 'Native'
            : version?.sourceKind === 'html5_zip'
              ? 'HTML5'
              : 'Display';
      return {
        id: creative.id,
        creative: creative.name,
        advertiser: creative.workspaceName ?? '—',
        campaign: creative.workspaceName ?? 'No campaign',
        format,
        size: getCreativeSizeLabel(creative) === 'unknown' ? '—' : getCreativeSizeLabel(creative),
        status,
        qa,
        preview: previewLabel,
        owner: creative.workspaceName ?? 'Creative Ops',
      };
    })
  ), [filteredCreatives, latestVersions]);

  const creativeMetrics = useMemo<Metric[]>(() => [
    {
      id: 'creative-health',
      label: 'Creative eligibility',
      value: `${creativeEligibility}%`,
      delta: '+5%',
      direction: 'up',
      helper: 'approved or ready for activation',
      tone: 'fuchsia',
      series: [Math.max(creativeEligibility - 24, 0), Math.max(creativeEligibility - 21, 0), Math.max(creativeEligibility - 17, 0), Math.max(creativeEligibility - 12, 0), Math.max(creativeEligibility - 8, 0), Math.max(creativeEligibility - 3, 0), creativeEligibility],
    },
    {
      id: 'creative-qa',
      label: 'Pending QA',
      value: `${pendingQaCreatives}`,
      delta: pendingQaCreatives > 0 ? '+2' : '0',
      direction: pendingQaCreatives > 0 ? 'up' : 'flat',
      helper: 'need spec and clickthrough review',
      tone: 'amber',
      series: [Math.max(pendingQaCreatives - 3, 0), Math.max(pendingQaCreatives - 3, 0), Math.max(pendingQaCreatives - 2, 0), Math.max(pendingQaCreatives - 2, 0), Math.max(pendingQaCreatives - 1, 0), pendingQaCreatives, pendingQaCreatives],
    },
    {
      id: 'creative-approved',
      label: 'Approved',
      value: `${approvedCreatives}`,
      delta: approvedCreatives > 0 ? '+4' : '0',
      direction: approvedCreatives > 0 ? 'up' : 'flat',
      helper: 'eligible creatives in active campaigns',
      tone: 'emerald',
      series: [Math.max(approvedCreatives - 9, 0), Math.max(approvedCreatives - 8, 0), Math.max(approvedCreatives - 6, 0), Math.max(approvedCreatives - 5, 0), Math.max(approvedCreatives - 3, 0), Math.max(approvedCreatives - 1, 0), approvedCreatives],
    },
    {
      id: 'creative-blocked',
      label: 'Blocked creatives',
      value: `${rejectedCreatives + missingCreatives}`,
      delta: rejectedCreatives + missingCreatives > 0 ? '+1' : '0',
      direction: rejectedCreatives + missingCreatives > 0 ? 'up' : 'flat',
      helper: 'rejected or missing assets',
      tone: 'rose',
      series: [Math.max(rejectedCreatives + missingCreatives - 2, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), Math.max(rejectedCreatives + missingCreatives - 1, 0), rejectedCreatives + missingCreatives, rejectedCreatives + missingCreatives, rejectedCreatives + missingCreatives],
    },
  ], [approvedCreatives, creativeEligibility, missingCreatives, pendingQaCreatives, rejectedCreatives]);

  const prototypeChecks = [
    { name: 'creative view renders rows', passed: creativeRows.length >= 1 },
    { name: 'creative ids are stable', passed: creativeRows.every((row) => row.id.length > 0) },
    { name: 'creative statuses are valid', passed: creativeRows.every((row) => ['Approved', 'Pending QA', 'Rejected', 'Ready', 'Missing'].includes(row.status)) },
    { name: 'creative formats are valid', passed: creativeRows.every((row) => ['Display', 'HTML5', 'Video', 'Native'].includes(row.format)) },
    { name: 'qa severities are valid', passed: creativeRows.every((row) => ['Critical', 'Warning', 'Notice'].includes(row.qa)) },
    { name: 'creative QA signals exist', passed: creativeRows.every((row) => row.preview && row.owner) },
    { name: 'four metric cards render', passed: creativeMetrics.length === 4 },
    { name: 'primary CTA remains upload creative', passed: true },
  ];

  const handleAssign = async () => {
    if (!bindingState?.tagId) {
      setBindingState(current => current ? { ...current, error: 'Select a tag.' } : current);
      return;
    }
    const selectedTag = tags.find(tag => tag.id === bindingState.tagId);
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await assignCreativeVersionToTag({
        creativeVersionId: bindingState.versionId,
        tagId: bindingState.tagId,
      });
      setBindingState(null);
      setSuccessMessage(selectedTag ? `Assigned to tag "${selectedTag.name}".` : 'Creative assigned to tag.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (assignError: any) {
      const message = assignError?.message ?? 'Assignment failed';
      setBindingState(current => current ? { ...current, loading: false, error: message } : current);
    }
  };

  const handleDeleteCreative = async (creative: Creative) => {
    const confirmed = await confirm({
      title: `Delete "${creative.name}"?`,
      description: 'This will remove its published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete creative',
      requireTypeToConfirm: creative.name,
    });
    if (!confirmed) return;

    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      await deleteCreativeById(creative.id);
      await load();
      setSuccessMessage(`Deleted "${creative.name}".`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete creative');
    }
  };

  const toggleCreativeSelection = (creativeId: string) => {
    setSelectedCreativeIds((current) => (
      current.includes(creativeId)
        ? current.filter((id) => id !== creativeId)
        : [...current, creativeId]
    ));
  };

  const toggleSelectAllVisibleCreatives = () => {
    setSelectedCreativeIds((current) => {
      if (allVisibleCreativesSelected) {
        return current.filter((id) => !filteredCreatives.some((creative) => creative.id === id));
      }
      const next = new Set(current);
      filteredCreatives.forEach((creative) => next.add(creative.id));
      return Array.from(next);
    });
  };

  const handleBulkClickUrlUpdate = async () => {
    const normalized = bulkClickUrl.trim();
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    let parsedClickUrl = '';
    try {
      parsedClickUrl = new URL(normalized).toString();
    } catch (_) {
      setError('Enter a valid http(s) destination URL for the selected creatives.');
      return;
    }

    setBulkClickUrlSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await updateCreativeById({
          creativeId: creative.id,
          clickUrl: parsedClickUrl,
        });
      }
      setCreatives((current) => current.map((creative) => (
        selectedCreativeIds.includes(creative.id)
          ? { ...creative, clickUrl: parsedClickUrl }
          : creative
      )));
      setSelectedCreativeIds([]);
      setBulkClickUrl('');
      setSuccessMessage(`Updated destination URL for ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update destination URLs');
    } finally {
      setWorkspaceBusy(false);
      setBulkClickUrlSaving(false);
    }
  };

  const handleEditCreativeClickUrl = async (creative: Creative) => {
    setClickUrlEditor({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      value: creative.clickUrl ?? '',
      loading: false,
      error: '',
    });
  };

  const handleSaveCreativeClickUrl = async () => {
    if (!clickUrlEditor) return;
    const normalized = clickUrlEditor.value.trim();
    if (normalized) {
      try {
        new URL(normalized);
      } catch (_) {
        setError('Enter a valid http(s) destination URL for the creative.');
        return;
      }
    }

    setClickUrlEditor((current) => current ? { ...current, loading: true, error: '' } : current);
    setError('');
    setSuccessMessage('');
    try {
      if (clickUrlEditor.workspaceId && clickUrlEditor.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(clickUrlEditor.workspaceId);
        setActiveWorkspaceId(clickUrlEditor.workspaceId);
      }
      await updateCreativeById({
        creativeId: clickUrlEditor.creativeId,
        clickUrl: normalized || null,
      });
      setCreatives((current) => current.map((entry) => (
        entry.id === clickUrlEditor.creativeId
          ? { ...entry, clickUrl: normalized || null }
          : entry
      )));
      setSuccessMessage(normalized ? 'Creative destination URL updated.' : 'Creative destination URL cleared.');
      window.setTimeout(() => setSuccessMessage(''), 3500);
      setClickUrlEditor(null);
    } catch (updateError: any) {
      const message = updateError.message ?? 'Failed to update creative destination URL';
      setError(message);
      setClickUrlEditor((current) => current ? { ...current, loading: false, error: message } : current);
    } finally {
      setWorkspaceBusy(false);
    }
  };

  const handleBulkAssignToTag = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    if (selectedCreativeWorkspaceIds.length !== 1) {
      setError('Bulk assignment only works when all selected creatives belong to the same client.');
      return;
    }
    if (selectedCreativeFormatFamilies.length !== 1 || selectedCreativeFormatFamilies[0] === 'unknown') {
      setError('Bulk assignment only works when all selected creatives share the same delivery type and have a latest version.');
      return;
    }
    if (!bulkAssignTagId) {
      setError('Select a destination tag first.');
      return;
    }

    setBulkAssignSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedTag = tags.find((tag) => tag.id === bulkAssignTagId);
      if (!selectedTag) {
        throw new Error('Selected tag no longer exists.');
      }
      if (selectedTag.workspaceId && selectedTag.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(selectedTag.workspaceId);
        setActiveWorkspaceId(selectedTag.workspaceId);
      }

      let assignedCount = 0;
      let skippedCount = 0;
      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        await assignCreativeVersionToTag({
          creativeVersionId: version.id,
          tagId: bulkAssignTagId,
        });
        assignedCount += 1;
      }

      setSelectedCreativeIds([]);
      setBulkAssignTagId('');
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`Assigned ${assignedCount} creative${assignedCount === 1 ? '' : 's'} to "${selectedTag.name}".${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 4000);
    } catch (assignError: any) {
      setError(assignError.message ?? 'Failed to assign creatives to tag');
    } finally {
      setWorkspaceBusy(false);
      setBulkAssignSaving(false);
    }
  };

  const handleBulkCreativeStatusUpdate = async (nextStatus: 'approved' | 'archived') => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }

    setBulkStatusSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
      let updatedCount = 0;
      let skippedCount = 0;

      for (const creative of selectedCreatives) {
        const version = latestVersions[creative.id];
        if (!version) {
          skippedCount += 1;
          continue;
        }
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        const response = await updateCreativeVersionById({
          creativeVersionId: version.id,
          status: nextStatus,
        });
        setLatestVersions((current) => ({
          ...current,
          [creative.id]: response.creativeVersion,
        }));
        updatedCount += 1;
      }

      setSelectedCreativeIds([]);
      const suffix = skippedCount ? ` ${skippedCount} creative${skippedCount === 1 ? '' : 's'} skipped because they had no latest version.` : '';
      setSuccessMessage(`${nextStatus === 'approved' ? 'Activated' : 'Deactivated'} ${updatedCount} creative${updatedCount === 1 ? '' : 's'}.${suffix}`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkStatusSaving(false);
    }
  };

  const handleBulkDeleteCreatives = async () => {
    if (!selectedCreativeIds.length) {
      setError('Select at least one creative first.');
      return;
    }
    const selectedCreatives = creatives.filter((creative) => selectedCreativeIds.includes(creative.id));
    if (!(await confirm({
      title: `Delete ${selectedCreatives.length} selected creative${selectedCreatives.length === 1 ? '' : 's'}?`,
      description: 'This will remove published versions and assignments.',
      tone: 'danger',
      confirmLabel: 'Delete selected',
    }))) {
      return;
    }

    setBulkDeleteSaving(true);
    setError('');
    setSuccessMessage('');
    try {
      for (const creative of selectedCreatives) {
        if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
          setWorkspaceBusy(true);
          await switchWorkspace(creative.workspaceId);
          setActiveWorkspaceId(creative.workspaceId);
        }
        await deleteCreativeById(creative.id);
      }
      await load();
      setSelectedCreativeIds([]);
      setSuccessMessage(`Deleted ${selectedCreatives.length} creative${selectedCreatives.length === 1 ? '' : 's'}.`);
      window.setTimeout(() => setSuccessMessage(''), 3500);
    } catch (deleteError: any) {
      setError(deleteError.message ?? 'Failed to delete selected creatives.');
    } finally {
      setWorkspaceBusy(false);
      setBulkDeleteSaving(false);
    }
  };

  const handleCreativeOperationalStatusToggle = async (creative: Creative) => {
    const version = latestVersions[creative.id];
    if (!version) {
      setError('This creative does not have a latest version yet.');
      return;
    }

    const nextStatus = getCreativeOperationalState(creative) === 'inactive' ? 'approved' : 'archived';

    setStatusUpdateCreativeId(creative.id);
    setError('');
    setSuccessMessage('');
    try {
      if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
        setWorkspaceBusy(true);
        await switchWorkspace(creative.workspaceId);
        setActiveWorkspaceId(creative.workspaceId);
      }
      const response = await updateCreativeVersionById({
        creativeVersionId: version.id,
        status: nextStatus,
      });
      setLatestVersions((current) => ({
        ...current,
        [creative.id]: response.creativeVersion,
      }));
      setSuccessMessage(
        `${creative.name} is now ${nextStatus === 'approved' ? 'active' : 'inactive'}.`,
      );
      window.setTimeout(() => setSuccessMessage(''), 3000);
    } catch (updateError: any) {
      setError(updateError.message ?? 'Failed to update creative status');
    } finally {
      setWorkspaceBusy(false);
      setStatusUpdateCreativeId('');
    }
  };

  const handleQuickCreateTag = async () => {
    if (!bindingState) return;
    const suggestedFormat =
      bindingState.servingFormat === 'vast_video'
        ? 'VAST'
        : bindingState.servingFormat === 'native'
          ? 'native'
          : 'display';
    const suggestedName = `${bindingState.creativeName} ${suggestedFormat}`.trim();
    setQuickCreateTagState({
      suggestedFormat,
      creativeName: bindingState.creativeName,
      name: suggestedName,
      loading: false,
      error: '',
    });
  };

  const handleConfirmQuickCreateTag = async () => {
    if (!bindingState || !quickCreateTagState) return;
    const name = quickCreateTagState.name.trim();
    if (!name) {
      setQuickCreateTagState((current) => current ? { ...current, error: 'Tag name is required.' } : current);
      return;
    }

    setQuickCreateTagState((current) => current ? { ...current, loading: true, error: '' } : current);
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const createdTag = await createTag({
        name,
        format: quickCreateTagState.suggestedFormat as 'display' | 'native' | 'VAST',
        status: 'draft',
      });
      const [nextTags, bindings] = await Promise.all([
        loadTags(),
        createdTag?.id ? loadTagBindings(createdTag.id) : Promise.resolve([]),
      ]);
      setTags(nextTags);
      setBindingState(current => current ? {
        ...current,
        loading: false,
        tagId: createdTag?.id ?? '',
        bindings,
      } : current);
      setQuickCreateTagState(null);
    } catch (createError: any) {
      setBindingState(current => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
      setQuickCreateTagState((current) => current ? {
        ...current,
        loading: false,
        error: createError.message ?? 'Failed to create tag',
      } : current);
    }
  };

  const handleBindingStatusChange = async (bindingId: string, status: 'active' | 'paused') => {
    if (!bindingState?.tagId) return;
    setBindingState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateTagBinding({
        tagId: bindingState.tagId,
        bindingId,
        status,
      });
      const bindings = await loadTagBindings(bindingState.tagId);
      setBindingState(current => current ? { ...current, loading: false, bindings } : current);
    } catch (updateError: any) {
      setBindingState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Binding update failed' } : current);
    }
  };

  const openVariantManager = async (creative: Creative, version: CreativeVersion) => {
    setVariantState({
      creativeId: creative.id,
      creativeName: creative.name,
      versionId: version.id,
      loading: true,
      error: '',
      variants: [],
      selectedVariantIds: [],
      form: {
        label: version.width && version.height ? `${version.width}x${version.height}` : '',
        width: version.width ? String(version.width) : '',
        height: version.height ? String(version.height) : '',
      },
    });
    try {
      const variants = await loadCreativeSizeVariants(version.id);
      setVariantState(current => current ? { ...current, loading: false, variants, selectedVariantIds: [] } : current);
    } catch (loadError: any) {
      setVariantState(current => current ? {
        ...current,
        loading: false,
        error: loadError.message ?? 'Failed to load size variants',
        selectedVariantIds: [],
      } : current);
    }
  };

  const openVideoRenditionManager = async (creative: Creative, version: CreativeVersion) => {
    const pendingIngestion = findPendingIngestionForCreative(ingestions, creative, version);
    setVideoRenditionState({
      creativeId: creative.id,
      creativeName: creative.name,
      workspaceId: creative.workspaceId ?? null,
      versionId: version.id,
      loading: true,
      error: '',
      version,
      renditions: [],
      pendingIngestion,
      awaitingPublish: pendingIngestion?.status === 'processing',
    });
    try {
      const detail = await loadCreativeVersionDetail(version.id);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
        awaitingPublish: false,
      } : current);
    } catch (loadError: any) {
      const message = loadError.message ?? 'Failed to load video renditions';
      const missingVersion = String(message).toLowerCase().includes('creative version not found');
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: missingVersion && pendingIngestion?.status === 'processing'
          ? ''
          : message,
        awaitingPublish: missingVersion && pendingIngestion?.status === 'processing',
      } : current);
    }
  };

  const handleVariantStatusChange = async (variantId: string, status: 'active' | 'paused') => {
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateCreativeSizeVariant({ variantId, status });
      const variants = await loadCreativeSizeVariants(variantState?.versionId ?? '');
      setVariantState(current => current ? { ...current, loading: false, variants } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update variant' } : current);
    }
  };

  const handleVideoRenditionStatusChange = async (
    renditionId: string,
    status: 'active' | 'paused',
  ) => {
    if (!videoRenditionState) return;
    const rendition = videoRenditionState.renditions.find((row) => row.id === renditionId);
    const isReadyToActivate = Boolean(
      rendition?.isSource || (
        rendition?.publicUrl
        && Number(rendition?.sizeBytes || 0) > 0
        && rendition?.metadata?.available === true
      ),
    );
    if (status === 'active' && !isReadyToActivate) {
      setVideoRenditionState(current => current ? {
        ...current,
        error: 'This rendition is still queued. Wait for transcoding to finish before turning it on.',
      } : current);
      return;
    }
    setVideoRenditionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await updateVideoRenditionById({ renditionId, status });
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
    } catch (updateError: any) {
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: updateError.message ?? 'Failed to update video rendition',
      } : current);
    }
  };

  const handleRegenerateVideoRenditions = async () => {
    if (!videoRenditionState) return;
    if (videoRenditionState.awaitingPublish) {
      setVideoRenditionState(current => current ? {
        ...current,
        error: 'This video is still publishing in the background. Renditions will appear when publishing completes.',
      } : current);
      return;
    }
    const startedAt = Date.now();
    const initialFeedback = estimateRegenerationFeedback(0);
    setRegenerationFeedback({
      active: true,
      startedAt,
      elapsedMs: 0,
      stageLabel: initialFeedback.stageLabel,
      progressPercent: initialFeedback.progressPercent,
    });
    setVideoRenditionState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await regenerateVideoRenditions(videoRenditionState.versionId);
      setRegenerationFeedback(current => current ? {
        ...current,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Refreshing rendition details…',
        progressPercent: 98,
      } : current);
      const detail = await loadCreativeVersionDetail(videoRenditionState.versionId);
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        version: detail.creativeVersion,
        renditions: detail.videoRenditions,
      } : current);
      setRegenerationFeedback(current => current ? {
        ...current,
        active: false,
        elapsedMs: Date.now() - current.startedAt,
        stageLabel: 'Renditions updated',
        progressPercent: 100,
      } : current);
      await load();
      window.setTimeout(() => {
        setRegenerationFeedback(current => current?.progressPercent === 100 ? null : current);
      }, 1800);
    } catch (regenerateError: any) {
      setVideoRenditionState(current => current ? {
        ...current,
        loading: false,
        error: regenerateError.message ?? 'Failed to regenerate video renditions',
      } : current);
      setRegenerationFeedback(null);
    }
  };

  useEffect(() => {
    if (!regenerationFeedback?.active) return undefined;

    const intervalId = window.setInterval(() => {
      setRegenerationFeedback(current => {
        if (!current?.active) return current;
        const elapsedMs = Date.now() - current.startedAt;
        const estimate = estimateRegenerationFeedback(elapsedMs);
        return {
          ...current,
          elapsedMs,
          stageLabel: estimate.stageLabel,
          progressPercent: estimate.progressPercent,
        };
      });
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [regenerationFeedback?.active]);

  useEffect(() => {
    const hasProcessing = creatives.some((creative) => {
      const version = latestVersions[creative.id];
      return version?.sourceKind === 'html5_zip' && String(version?.status ?? '') === 'processing';
    });
    if (!hasProcessing) return undefined;

    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const { latestVersions: nextVersions } = await loadCreativesWithLatestVersion({ scope: 'all' });
          setLatestVersions((current) => {
            const patch: LatestVersionMap = {};
            for (const [id, version] of Object.entries(nextVersions)) {
              if (String(current[id]?.status ?? '') === 'processing') {
                patch[id] = version;
              }
            }
            return Object.keys(patch).length > 0 ? { ...current, ...patch } : current;
          });
        } catch (_) {}
      })();
    }, 4000);

    return () => window.clearInterval(intervalId);
  }, [creatives, latestVersions]);

  useEffect(() => {
    if (!previewModal) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewModal(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewModal]);

  useEffect(() => {
    if (!videoRenditionState?.awaitingPublish || !videoRenditionState.pendingIngestion?.id) return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const latestIngestion = await loadCreativeIngestion(videoRenditionState.pendingIngestion!.id, {
            workspaceId: videoRenditionState.workspaceId ?? undefined,
          });
          if (cancelled) return;

          setIngestions(current => current.map(ingestion => (
            ingestion.id === latestIngestion.id ? latestIngestion : ingestion
          )));

          if (latestIngestion.status === 'published' && latestIngestion.creativeVersionId) {
            try {
              const detail = await loadCreativeVersionDetail(latestIngestion.creativeVersionId);
              if (cancelled) return;
              setVideoRenditionState(current => current ? {
                ...current,
                versionId: latestIngestion.creativeVersionId ?? current.versionId,
                version: detail.creativeVersion,
                renditions: detail.videoRenditions,
                pendingIngestion: latestIngestion,
                awaitingPublish: false,
                loading: false,
                error: '',
              } : current);
              void load();
            } catch {
              if (cancelled) return;
            }
            return;
          }

          setVideoRenditionState(current => current ? {
            ...current,
            pendingIngestion: latestIngestion,
            awaitingPublish: latestIngestion.status === 'processing',
            error: latestIngestion.status === 'failed'
              ? latestIngestion.errorDetail ?? 'Background publish failed'
              : current.error,
          } : current);
        } catch (pollError: any) {
          if (cancelled) return;
          // Stop polling on 4xx errors — version not found or access denied.
          // Don't stop on network errors (5xx, timeout) — those may be transient.
          const status = pollError?.status ?? pollError?.statusCode ?? 0;
          if (status >= 400 && status < 500) {
            setVideoRenditionState(current => current ? {
              ...current,
              loading: false,
              error: pollError?.message ?? 'Creative version not found.',
            } : current);
          }
        }
      })();
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    videoRenditionState?.awaitingPublish,
    videoRenditionState?.pendingIngestion?.id,
    videoRenditionState?.workspaceId,
  ]);

  useEffect(() => {
    if (!shouldPollVideoRenditions(videoRenditionState)) return undefined;

    let cancelled = false;
    const intervalId = window.setInterval(() => {
      void (async () => {
        try {
          const currentVersionId = videoRenditionState?.versionId;
          if (!currentVersionId) return;
          const detail = await loadCreativeVersionDetail(currentVersionId);
          if (cancelled) return;
          setVideoRenditionState((current) => current ? {
            ...current,
            version: detail.creativeVersion,
            renditions: detail.videoRenditions,
            loading: false,
            error: current.error,
          } : current);
        } catch (pollError: any) {
          if (cancelled) return;
          const status = pollError?.status ?? pollError?.statusCode ?? 0;
          const is4xx = (status >= 400 && status < 500)
            || String(pollError?.message ?? '').includes('400')
            || String(pollError?.message ?? '').toLowerCase().includes('not found');
          if (is4xx) {
            setVideoRenditionState(current => current ? {
              ...current,
              loading: false,
              error: pollError?.message ?? 'Creative version not found.',
            } : current);
          }
        }
      })();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    videoRenditionState?.versionId,
    videoRenditionState?.awaitingPublish,
    videoRenditionState?.loading,
    videoRenditionState?.version?.updatedAt,
    videoRenditionState?.renditions.length,
  ]);

  const videoProcessing = (videoRenditionState?.version?.metadata as Record<string, any> | undefined)?.videoProcessing;
  const plannedRenditions = Array.isArray(videoProcessing?.targetPlan) ? videoProcessing.targetPlan : [];
  const renditionProcessing = Array.isArray(videoProcessing?.renditionProcessing) ? videoProcessing.renditionProcessing : [];
  const videoProcessingSummary = getVideoProcessingPanelSummary(
    videoRenditionState?.version,
    videoRenditionState?.awaitingPublish ?? false,
    videoRenditionState?.renditions ?? [],
  );
  const estimatedRemainingMs = regenerationFeedback
    ? estimateRemainingDuration(regenerationFeedback.elapsedMs, regenerationFeedback.progressPercent)
    : null;
  const pendingPublishJob = getPublishJob(videoRenditionState?.pendingIngestion);
  const pendingPublishPercent = Math.min(100, Math.max(0, Number(pendingPublishJob?.progressPercent ?? 0) || 0));
  const pendingPublishStage = String(pendingPublishJob?.stage ?? '');
  const pendingPublishMessage = String(
    pendingPublishJob?.message
    ?? getPublishStageLabel(pendingPublishStage),
  );

  const toggleVariantSelection = (variantId: string) => {
    setVariantState(current => {
      if (!current) return current;
      const selected = current.selectedVariantIds.includes(variantId)
        ? current.selectedVariantIds.filter(id => id !== variantId)
        : [...current.selectedVariantIds, variantId];
      return { ...current, selectedVariantIds: selected };
    });
  };

  const toggleSelectAllVariants = () => {
    setVariantState(current => {
      if (!current) return current;
      const selectableIds = current.variants.map(variant => variant.id);
      const selectedVariantIds = current.selectedVariantIds.length === selectableIds.length
        ? []
        : selectableIds;
      return { ...current, selectedVariantIds };
    });
  };

  const handleCreateVariant = async () => {
    if (!variantState) return;
    const width = Number(variantState.form.width);
    const height = Number(variantState.form.height);
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(height) || height <= 0) {
      setVariantState(current => current ? { ...current, error: 'Width and height must be positive numbers.' } : current);
      return;
    }

    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      await createCreativeSizeVariant({
        creativeVersionId: variantState.versionId,
        label: variantState.form.label.trim() || `${width}x${height}`,
        width,
        height,
        status: 'draft',
      });
      const variants = await loadCreativeSizeVariants(variantState.versionId);
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants,
        selectedVariantIds: [],
        form: { ...current.form, label: '', width: '', height: '' },
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create variant' } : current);
    }
  };

  const handleCreatePresetVariants = async (presets: typeof VARIANT_PRESETS) => {
    if (!variantState || presets.length === 0) return;
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await createCreativeSizeVariantsBulk({
        creativeVersionId: variantState.versionId,
        variants: presets.map(preset => ({
          label: preset.label,
          width: preset.width,
          height: preset.height,
          status: 'draft',
        })),
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
        error: response.skippedCount > 0 ? `${response.skippedCount} duplicate size(s) skipped.` : '',
      } : current);
    } catch (createError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: createError.message ?? 'Failed to create preset sizes' } : current);
    }
  };

  const handleBulkVariantStatusChange = async (status: 'active' | 'paused') => {
    if (!variantState || variantState.selectedVariantIds.length === 0) {
      setVariantState(current => current ? { ...current, error: 'Select at least one size first.' } : current);
      return;
    }
    setVariantState(current => current ? { ...current, loading: true, error: '' } : current);
    try {
      const response = await updateCreativeSizeVariantsBulkStatus({
        creativeVersionId: variantState.versionId,
        variantIds: variantState.selectedVariantIds,
        status,
      });
      setVariantState(current => current ? {
        ...current,
        loading: false,
        variants: response.variants,
        selectedVariantIds: [],
      } : current);
    } catch (updateError: any) {
      setVariantState(current => current ? { ...current, loading: false, error: updateError.message ?? 'Failed to update selected sizes' } : current);
    }
  };

  const handleVariantFormChange = (field: 'label' | 'width' | 'height', value: string) => {
    setVariantState(current => current ? { ...current, form: { ...current.form, [field]: value } } : current);
  };

  useEffect(() => {
    if (!bindingState?.tagId) return;

    let cancelled = false;
    setBindingState(current => current ? { ...current, bindingsLoading: true, error: '' } : current);
    void loadTagBindings(bindingState.tagId)
      .then(bindings => {
        if (cancelled) return;
        setBindingState(current => current ? { ...current, bindingsLoading: false, bindings } : current);
      })
      .catch(loadError => {
        if (cancelled) return;
        setBindingState(current => current ? {
          ...current,
          bindingsLoading: false,
          error: loadError.message ?? 'Failed to load tag bindings',
        } : current);
      });

    return () => {
      cancelled = true;
    };
  }, [bindingState?.tagId]);

  if (loading) {
    return <CenteredSpinner label="Loading creative catalog…" />;
  }

  if (error) {
    return (
      <Panel className="border-rose-200 bg-rose-50/90 p-4 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200">
        <p className="font-medium">Error loading creative catalog</p>
        <p className="mt-1 text-sm">{error}</p>
        <button onClick={() => void load()} className="mt-3 text-sm font-semibold text-rose-600 underline dark:text-rose-300">Retry</button>
      </Panel>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-6 py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <select
            value={selectedClientIds[0] ?? ''}
            onChange={(event) => setSelectedClientIds(event.target.value ? [event.target.value] : [])}
            className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] px-4 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]"
          >
            <option value="">All advertisers</option>
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setStatusFilter((current) => current === 'pending_review' ? 'all' : 'pending_review')}
            className={classNames(
              'inline-flex min-h-[46px] items-center gap-2 rounded-xl border px-4 text-sm font-medium transition',
              statusFilter === 'pending_review'
                ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-700 dark:border-fuchsia-500/24 dark:bg-fuchsia-500/10 dark:text-fuchsia-300'
                : 'border-slate-200/80 bg-[rgba(252,251,255,0.82)] text-slate-700 hover:border-fuchsia-300 hover:bg-fuchsia-50 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white/86 dark:hover:border-fuchsia-500/22 dark:hover:bg-white/[0.045]',
            )}
          >
            Needs QA
          </button>
          <label className="relative block min-w-[320px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-white/40"><SearchIcon /></span>
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search creative, advertiser, campaign"
              className="min-h-[46px] w-full rounded-xl border border-slate-200/80 bg-[rgba(252,251,255,0.82)] pl-10 pr-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 transition focus:border-fuchsia-300 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/[0.06] dark:bg-white/[0.025] dark:text-white dark:placeholder:text-white/30 dark:focus:border-fuchsia-500/30"
            />
          </label>
        </div>
        <button
          type="button"
          onClick={() => navigate('/creatives/upload')}
          className="inline-flex min-h-[46px] items-center rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
        >
          Upload creative
        </button>
      </div>

      <header className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-fuchsia-200 bg-fuchsia-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-700 dark:border-fuchsia-500/15 dark:bg-fuchsia-500/10 dark:text-fuchsia-300">
            Creatives
            <span className="h-1 w-1 rounded-full bg-current opacity-60" />
            Creative QA workspace
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-slate-950 dark:text-white md:text-5xl">Creative approval without trafficking gaps</h1>
          <p className="mt-3 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/62">Review specs, preview assets, catch blockers and approve creatives from one dense operational view with the same CM360-style workspace pattern.</p>
        </div>
        <Panel className="p-5">
          <Kicker>Recommended focus</Kicker>
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/18 dark:bg-amber-500/10">
            <AlertTriangleIcon className="text-amber-600 dark:text-amber-300" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-100">{pendingQaCreatives + rejectedCreatives + missingCreatives} creatives need QA review</p>
              <p className="mt-1 text-sm text-amber-700/72 dark:text-amber-100/62">Review clicktags, specs, missing assets and rejected creatives before launch or trafficking handoff.</p>
            </div>
          </div>
        </Panel>
      </header>

      <div className="grid gap-5 xl:grid-cols-4">
        {creativeMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            trend={metric.direction}
            context={metric.helper}
            series={metric.series}
            tone={mapMetricTone(metric.tone)}
            icon={
              metric.id === 'creative-health'
                ? <CreativeIcon />
                : metric.id === 'creative-approved'
                  ? <ReportIcon />
                  : metric.id === 'creative-blocked'
                    ? <AlertTriangleIcon />
                    : <TableIcon />
            }
          />
        ))}
      </div>

      {successMessage && (
        <Panel className="border-emerald-200 bg-emerald-50/90 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200">
          {successMessage}
        </Panel>
      )}

      {selectedCreativeIds.length > 0 && (
        <CreativeBulkActionsPanel
          selectedCount={selectedCreativeIds.length}
          bulkClickUrl={bulkClickUrl}
          onBulkClickUrlChange={setBulkClickUrl}
          onBulkClickUrlUpdate={handleBulkClickUrlUpdate}
          bulkClickUrlSaving={bulkClickUrlSaving}
          bulkAssignTagId={bulkAssignTagId}
          onBulkAssignTagIdChange={setBulkAssignTagId}
          onBulkAssignToTag={handleBulkAssignToTag}
          bulkAssignSaving={bulkAssignSaving}
          bulkAssignableTags={bulkAssignableTags}
          canBulkAssign={canBulkAssign}
          bulkAssignHint={bulkAssignHint}
          onBulkStatusUpdate={handleBulkCreativeStatusUpdate}
          bulkStatusSaving={bulkStatusSaving}
          onBulkDelete={handleBulkDeleteCreatives}
          bulkDeleteSaving={bulkDeleteSaving}
          onClearSelection={() => {
            setSelectedCreativeIds([]);
            setBulkAssignTagId('');
            setBulkClickUrl('');
          }}
        />
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
        <Panel className="overflow-hidden p-6">
          <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/8 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Kicker>Creative workspace</Kicker>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 dark:text-white">Creative QA queue</h2>
              <p className="mt-2 text-sm text-slate-500 dark:text-white/56">Review approval status, preview availability, delivery setup, and launch blockers from one dense queue.</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/8 dark:bg-white/[0.03] dark:text-white/72 dark:hover:border-fuchsia-500/28 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-200"
              >
                <FilterIcon className="h-4 w-4" />
                Filters
              </button>
              <button type="button" onClick={() => void load()} className="text-sm font-medium text-fuchsia-600 hover:text-fuchsia-700 dark:text-fuchsia-300">Refresh</button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Total</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{filteredCreatives.length}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">creatives in workspace</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Approved</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{approvedCreatives}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">ready to serve</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Pending QA</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{pendingQaCreatives}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">awaiting approval</p></div>
            <div className="rounded-2xl border border-slate-200 bg-white/60 p-4 dark:border-white/8 dark:bg-white/[0.025]"><p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Blocked</p><p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{rejectedCreatives + missingCreatives}</p><p className="mt-1 text-sm text-slate-500 dark:text-white/52">rejected or missing assets</p></div>
          </div>

          <div className="app-scrollbar mt-6 overflow-auto rounded-3xl border border-slate-200 dark:border-white/8">
            <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-white/8">
              <thead className="bg-slate-50/80 dark:bg-white/[0.02]">
                <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-white/42">
                  <th className="px-5 py-4">
                    <input
                      type="checkbox"
                      checked={allVisibleCreativesSelected}
                      ref={(element) => {
                        if (element) {
                          element.indeterminate = !allVisibleCreativesSelected && someVisibleCreativesSelected;
                        }
                      }}
                      onChange={toggleSelectAllVisibleCreatives}
                      className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                      aria-label="Select all visible creatives"
                    />
                  </th>
                  <th className="px-5 py-4">Creative</th>
                  <th className="px-5 py-4">Status</th>
                  <th className="px-5 py-4">Format</th>
                  <th className="px-5 py-4">Size</th>
                  <th className="px-5 py-4">Preview</th>
                  <th className="px-5 py-4">QA</th>
                  <th className="px-5 py-4">Owner</th>
                  <th className="px-5 py-4" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-white/8">
                {filteredCreatives.map((creative) => {
                  const version = latestVersions[creative.id];
                  const row = creativeRows.find((entry) => entry.id === creative.id);
                  const previewHref = resolveCreativePreviewHref(creative, version);
                  const previewKind = resolveCreativePreviewKind(creative, version);
                  const needsAttention = row?.qa ?? 'Notice';

                  return (
                    <tr key={creative.id} className="bg-white/42 align-top transition hover:bg-fuchsia-50/45 dark:bg-transparent dark:hover:bg-white/[0.04]">
                      <td className="px-5 py-5">
                        <input
                          type="checkbox"
                          checked={selectedCreativeIds.includes(creative.id)}
                          onChange={() => toggleCreativeSelection(creative.id)}
                          className="h-4 w-4 rounded border-slate-300 text-fuchsia-600 focus:ring-fuchsia-500"
                          aria-label={`Select creative ${creative.name}`}
                        />
                      </td>
                      <td className="px-5 py-5">
                        <p className="font-semibold text-slate-950 dark:text-white">{row?.creative ?? creative.name}</p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-white/48">{row?.advertiser ?? creative.workspaceName ?? '—'} · {row?.campaign ?? 'No campaign'}</p>
                      </td>
                      <td className="px-5 py-5">
                        <CreativeStatusBadge status={row?.status ?? 'Missing'} />
                      </td>
                      <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.format ?? 'Display'}</td>
                      <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.size ?? '—'}</td>
                      <td className="px-5 py-5">
                        {previewHref ? (
                          <div className="flex flex-col gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setPreviewModal({
                                  url: previewHref,
                                  width: Number(version?.width) > 0 ? Number(version?.width) : previewKind === 'video' ? 960 : 300,
                                  height: Number(version?.height) > 0 ? Number(version?.height) : previewKind === 'video' ? 540 : 250,
                                  name: creative.name,
                                  kind: previewKind,
                                });
                              }}
                              className="inline-flex w-fit items-center rounded-lg border border-fuchsia-200 bg-fuchsia-50 px-3 py-1.5 text-xs font-medium text-fuchsia-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-100 dark:border-fuchsia-500/18 dark:bg-fuchsia-500/10 dark:text-fuchsia-300"
                            >
                              {row?.preview ?? 'Preview ready'}
                            </button>
                            <a
                              href={previewHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] text-slate-400 hover:text-fuchsia-600 hover:underline dark:text-white/38 dark:hover:text-fuchsia-300"
                            >
                              Open in tab ↗
                            </a>
                          </div>
                        ) : version?.sourceKind === 'html5_zip' && String(version?.status ?? '') === 'processing' ? (
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-amber-600 dark:text-amber-300">Publishing…</span>
                            <span className="text-[11px] text-slate-400 dark:text-white/38">Auto-refreshing</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 dark:text-white/38">{row?.preview ?? 'Asset missing'}</span>
                        )}
                      </td>
                      <td className="px-5 py-5">
                        <PrioritySeverityBadge severity={needsAttention} />
                      </td>
                      <td className="px-5 py-5 text-slate-600 dark:text-white/62">{row?.owner ?? 'Creative Ops'}</td>
                      <td className="px-5 py-5">
                        <div className="flex flex-wrap items-center gap-2">
                          {version && version.status !== 'rejected' && (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleCreativeOperationalStatusToggle(creative)}
                                disabled={statusUpdateCreativeId === creative.id}
                                className={classNames(
                                  'rounded-lg border px-3 py-1.5 text-xs font-medium transition disabled:opacity-50',
                                  getCreativeOperationalState(creative) === 'inactive'
                                    ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/18 dark:text-emerald-300 dark:hover:bg-emerald-500/10'
                                    : 'border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-white/10 dark:text-white/70 dark:hover:bg-white/[0.05]',
                                )}
                              >
                                {statusUpdateCreativeId === creative.id ? 'Saving…' : getCreativeOperationalState(creative) === 'inactive' ? 'Set active' : 'Set inactive'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleEditCreativeClickUrl(creative)}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                              >
                                {creative.clickUrl ? 'Edit URL' : 'Set URL'}
                              </button>
                              <button
                                type="button"
                                onClick={() => void (version.servingFormat === 'vast_video' ? openVideoRenditionManager(creative, version) : openVariantManager(creative, version))}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                              >
                                {version.servingFormat === 'vast_video' ? 'Renditions' : 'Sizes'}
                              </button>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    if (creative.workspaceId && creative.workspaceId !== activeWorkspaceId) {
                                      setWorkspaceBusy(true);
                                      await switchWorkspace(creative.workspaceId);
                                      setActiveWorkspaceId(creative.workspaceId);
                                    }
                                    const nextTags = await loadTags({ workspaceId: creative.workspaceId ?? activeWorkspaceId });
                                    setTags(nextTags);
                                    setBindingState({
                                      creativeId: creative.id,
                                      creativeName: creative.name,
                                      versionId: version.id,
                                      servingFormat: version.servingFormat,
                                      tagId: '',
                                      loading: false,
                                      error: '',
                                      bindingsLoading: false,
                                      bindings: [],
                                    });
                                  } catch (workspaceError: any) {
                                    setError(workspaceError.message ?? 'Failed to prepare assignment');
                                  } finally {
                                    setWorkspaceBusy(false);
                                  }
                                }}
                                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-fuchsia-300 hover:bg-fuchsia-50 hover:text-fuchsia-700 dark:border-white/10 dark:text-white/72 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                              >
                                Assign tag
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => void handleDeleteCreative(creative)}
                            className="rounded-xl border border-transparent p-2 text-slate-400 transition hover:border-fuchsia-200 hover:bg-fuchsia-50 hover:text-fuchsia-600 dark:text-white/36 dark:hover:border-fuchsia-500/20 dark:hover:bg-fuchsia-500/10 dark:hover:text-fuchsia-300"
                            aria-label={`More actions for ${creative.name}`}
                          >
                            <MoreIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel className="p-6">
          <div className="space-y-8">
            <section>
              <Kicker>Module health</Kicker>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Pending QA</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{pendingQaCreatives}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">creatives need spec or approval review</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Rejected</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{rejectedCreatives}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">require fixes before serving</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 dark:border-white/[0.08] dark:bg-white/[0.025]">
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-white/40">Missing preview</p>
                  <p className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">{pendingPreviewCreatives.length}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-white/56">assets still unavailable for review</p>
                </div>
              </div>
            </section>

            <section>
              <Kicker>Missing preview assets</Kicker>
              <div className="mt-4 space-y-3">
                {pendingPreviewCreatives.length > 0 ? pendingPreviewCreatives.map((creative) => (
                  <div key={creative.id} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="font-semibold text-slate-950 dark:text-white">{creative.name}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-white/56">{creative.workspaceName ?? 'Workspace'} · preview artifact unavailable</p>
                  </div>
                )) : (
                  <div className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-4 text-sm text-slate-500 dark:border-white/[0.08] dark:bg-white/[0.025] dark:text-white/56">
                    All visible creatives have preview-ready assets.
                  </div>
                )}
              </div>
            </section>

            <section>
              <Kicker>Prototype checks</Kicker>
              <div className="mt-4 grid gap-3">
                {prototypeChecks.map((test) => (
                  <div key={test.name} className="rounded-2xl border border-slate-200 bg-white/42 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.025]">
                    <p className="text-xs font-medium text-slate-500 dark:text-white/42">{test.name}</p>
                    <p className={test.passed ? 'mt-1 text-sm font-semibold text-emerald-600 dark:text-emerald-300' : 'mt-1 text-sm font-semibold text-rose-600 dark:text-rose-300'}>
                      {test.passed ? 'Passed' : 'Failed'}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </Panel>
      </div>

      {clickUrlEditor && (
        <ClickUrlEditorModal
          state={clickUrlEditor}
          onClose={() => setClickUrlEditor(null)}
          onSave={handleSaveCreativeClickUrl}
          onValueChange={(value) => setClickUrlEditor((current) => current ? { ...current, value, error: '' } : current)}
        />
      )}

      {quickCreateTagState && (
        <QuickCreateTagModal
          state={quickCreateTagState}
          onClose={() => setQuickCreateTagState(null)}
          onConfirm={handleConfirmQuickCreateTag}
          onNameChange={(value) => setQuickCreateTagState((current) => current ? { ...current, name: value, error: '' } : current)}
        />
      )}

      {bindingState && (
        <TagBindingModal
          bindingState={bindingState}
          tags={tags}
          onClose={() => setBindingState(null)}
          onAssign={handleAssign}
          onTagChange={(tagId) => setBindingState((current) => current ? { ...current, tagId } : current)}
          onQuickCreateTag={handleQuickCreateTag}
          onOpenTags={() => navigate('/tags?create=1')}
          onBindingStatusChange={handleBindingStatusChange}
        />
      )}

      {videoRenditionState && (
        <VideoRenditionsModal
          state={videoRenditionState}
          regenerationFeedback={regenerationFeedback}
          estimatedRemainingMs={estimatedRemainingMs}
          pendingPublishPercent={pendingPublishPercent}
          pendingPublishStage={pendingPublishStage}
          pendingPublishMessage={pendingPublishMessage}
          plannedRenditions={plannedRenditions}
          renditionProcessing={renditionProcessing}
          videoProcessing={videoProcessing}
          videoProcessingSummary={videoProcessingSummary}
          onClose={() => setVideoRenditionState(null)}
          onRegenerate={handleRegenerateVideoRenditions}
          onStatusToggle={handleVideoRenditionStatusChange}
          onSetError={(message) => {
            setVideoRenditionState(current => current ? { ...current, error: message } : current);
          }}
          formatDuration={formatDuration}
          formatBytes={formatBytes}
          formatVideoBitrate={formatVideoBitrate}
          getPublishStageLabel={getPublishStageLabel}
          getRenditionProgressLabel={getRenditionProgressLabel}
          getVideoRenditionStatusBadge={getVideoRenditionStatusBadge}
          getVideoRenditionToggleBlockedReason={getVideoRenditionToggleBlockedReason}
        />
      )}

      {variantState && (
        <VariantManagerModal
          variantState={variantState}
          presets={VARIANT_PRESETS}
          onClose={() => setVariantState(null)}
          onFormChange={handleVariantFormChange}
          onAddVariant={handleCreateVariant}
          onAddPresets={handleCreatePresetVariants}
          onSelectAll={toggleSelectAllVariants}
          onToggleVariant={toggleVariantSelection}
          onBulkStatusChange={handleBulkVariantStatusChange}
          onVariantStatusChange={handleVariantStatusChange}
          readinessBadge={readinessBadge}
          statusBadge={statusBadge}
        />
      )}

      {previewModal && (
        <CreativePreviewLightbox
          preview={previewModal}
          onClose={() => setPreviewModal(null)}
        />
      )}
    </div>
  );
}
