import { strFromU8, unzipSync } from 'fflate';
import { detectClickTagInHtml } from '@smx/contracts';
import { type CreativeIngestion } from '../catalog';

export type SourceKind = 'html5_zip' | 'video_mp4';

export const ACCEPTED_EXTENSIONS: Record<SourceKind, string> = {
  html5_zip: '.zip',
  video_mp4: '.mp4',
};

export function buildFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function normalizeArchiveMemberPath(rawPath: string) {
  const trimmed = String(rawPath ?? '').trim().replace(/\\/g, '/').replace(/^\/+/, '');
  if (!trimmed) return null;
  if (trimmed.startsWith('__MACOSX/') || trimmed.endsWith('.DS_Store')) return null;
  if (trimmed.includes('../') || trimmed.includes('/..')) return null;
  return trimmed;
}

function stripCommonArchiveRoot(paths: string[]) {
  const valid = paths.filter(Boolean);
  if (!valid.length) return valid;
  const roots = valid.map((path) => path.split('/')[0]);
  const commonRoot = roots.every((root) => root === roots[0]) ? roots[0] : '';
  if (!commonRoot) return valid;
  const allNested = valid.every((path) => path.startsWith(`${commonRoot}/`));
  if (!allNested) return valid;
  return valid.map((path) => path.slice(commonRoot.length + 1)).filter(Boolean);
}

export async function detectHtml5ZipClickUrl(file: File) {
  try {
    const archive = unzipSync(new Uint8Array(await file.arrayBuffer()));
    const rawEntries = Object.entries(archive)
      .filter(([name, body]) => !name.endsWith('/') && body && body.length > 0)
      .map(([archivePath, body]) => ({
        archivePath: normalizeArchiveMemberPath(archivePath),
        body,
      }))
      .filter((entry): entry is { archivePath: string; body: Uint8Array } => Boolean(entry.archivePath));

    if (!rawEntries.length) return '';

    const strippedPaths = stripCommonArchiveRoot(rawEntries.map((entry) => entry.archivePath));
    const entries = rawEntries.map((entry, index) => ({
      ...entry,
      publishedPath: normalizeArchiveMemberPath(strippedPaths[index]) || entry.archivePath,
    }));

    const entryAsset = entries.find((entry) => entry.publishedPath.toLowerCase() === 'index.html')
      || entries.find((entry) => entry.publishedPath.toLowerCase().endsWith('/index.html'))
      || entries.find((entry) => entry.publishedPath.toLowerCase().endsWith('.html') || entry.publishedPath.toLowerCase().endsWith('.htm'))
      || null;

    if (!entryAsset) return '';
    return detectClickTagInHtml(strFromU8(entryAsset.body)) || '';
  } catch (_) {
    return '';
  }
}

export function normalizeHttpUrl(value: string) {
  const text = value.trim();
  if (!text) return '';
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch (_) {
    return '';
  }
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function estimateProcessingPercent(elapsedMs: number) {
  if (elapsedMs < 2000) return 8 + Math.round((elapsedMs / 2000) * 12);
  if (elapsedMs < 8000) return 20 + Math.round(((elapsedMs - 2000) / 6000) * 35);
  if (elapsedMs < 18000) return 55 + Math.round(((elapsedMs - 8000) / 10000) * 25);
  if (elapsedMs < 30000) return 80 + Math.round(((elapsedMs - 18000) / 12000) * 12);
  return 94;
}

export function getPublishJob(ingestion: CreativeIngestion | null | undefined) {
  const metadata = ingestion?.metadata;
  if (!metadata || typeof metadata !== 'object') return null;
  const publishJob = (metadata as Record<string, unknown>).publishJob;
  return publishJob && typeof publishJob === 'object'
    ? publishJob as Record<string, unknown>
    : null;
}

export function getProcessingStageMessage(stage: string | null | undefined, fallback: string) {
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
      return 'Finalizing published creative version…';
    case 'completed':
      return 'Publish completed.';
    case 'failed':
      return 'Publish failed.';
    default:
      return fallback;
  }
}

export function getDisplayProcessingPercent(ingestion: CreativeIngestion | null | undefined, elapsedMs: number) {
  const publishJob = getPublishJob(ingestion);
  const explicitPercent = Number(publishJob?.progressPercent ?? 0) || 0;
  const stage = String(publishJob?.stage ?? '');
  if (stage === 'transcoding_video') {
    return Math.max(explicitPercent, estimateProcessingPercent(elapsedMs));
  }
  return Math.min(100, explicitPercent);
}

export async function readVideoFileMetadata(file: File) {
  if (!file.type.startsWith('video/')) {
    return { width: null, height: null, durationMs: null };
  }

  return new Promise<{ width: number | null; height: number | null; durationMs: number | null }>((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    const cleanup = () => {
      video.removeAttribute('src');
      video.load();
      URL.revokeObjectURL(objectUrl);
    };
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const width = Number.isFinite(video.videoWidth) && video.videoWidth > 0 ? Math.round(video.videoWidth) : null;
      const height = Number.isFinite(video.videoHeight) && video.videoHeight > 0 ? Math.round(video.videoHeight) : null;
      const durationSeconds = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null;
      cleanup();
      resolve({
        width,
        height,
        durationMs: durationSeconds != null ? Math.round(durationSeconds * 1000) : null,
      });
    };
    video.onerror = () => {
      cleanup();
      resolve({ width: null, height: null, durationMs: null });
    };
    video.src = objectUrl;
  });
}

export function formatProcessingEta(ms: number) {
  return `Estimated remaining ${formatDuration(ms || 0)}`;
}
