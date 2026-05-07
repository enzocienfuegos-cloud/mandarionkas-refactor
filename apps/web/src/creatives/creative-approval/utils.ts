import type { CreativeArtifact, CreativeVersion } from '../catalog';

export function formatBytes(value?: number | null) {
  if (!value) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = value;
  let unit = units[0];
  for (let index = 0; index < units.length - 1 && size >= 1024; index += 1) {
    size /= 1024;
    unit = units[index + 1];
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`;
}

export function formatDuration(durationMs?: number | null) {
  if (!durationMs) return '—';
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function formatBitRate(bitRate?: number | null) {
  if (!bitRate) return '—';
  if (bitRate >= 1_000_000) return `${(bitRate / 1_000_000).toFixed(2)} Mbps`;
  if (bitRate >= 1_000) return `${(bitRate / 1_000).toFixed(0)} Kbps`;
  return `${bitRate} bps`;
}

export function readinessChecks(version: CreativeVersion | null, artifacts: CreativeArtifact[]) {
  return [
    { label: 'Public URL', ok: Boolean(version?.publicUrl) },
    { label: 'Previewable artifact', ok: artifacts.some((artifact) => Boolean(artifact.publicUrl)) },
    { label: 'Metadata', ok: Boolean(version?.mimeType || version?.width || version?.durationMs) },
  ];
}

export function getPosterArtifact(artifacts: CreativeArtifact[]) {
  return artifacts.find((artifact) => artifact.kind === 'poster' && artifact.publicUrl) ?? null;
}

export function getVideoProcessingState(version: CreativeVersion | null) {
  const processing = (version?.metadata as Record<string, any> | undefined)?.videoProcessing;
  if (!processing || typeof processing !== 'object') return null;
  return processing;
}

export function getVideoMetadata(version: CreativeVersion | null) {
  const metadata = (version?.metadata as Record<string, any> | undefined) ?? {};
  return {
    codec: typeof metadata.codec === 'string' ? metadata.codec : null,
    bitRate: typeof metadata.bitRate === 'number' ? metadata.bitRate : null,
    posterGenerated: Boolean(metadata.posterGenerated),
  };
}

export function resolveCreativePreviewHref(version: CreativeVersion | null | undefined) {
  const sourceKind = String(version?.sourceKind || '').trim().toLowerCase();
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const allowsIngestionArtifactPreview = sourceKind === 'video_mp4' || mimeType.startsWith('video/');
  const previewUrl = String(version?.previewUrl || '').trim();
  const isInvalidPreviewUrl = (value: string) => {
    const lower = value.toLowerCase();
    if (!value) return true;
    if (lower.endsWith('.zip')) return true;
    if (!allowsIngestionArtifactPreview && lower.includes('/creative-ingestions/')) return true;
    return false;
  };
  if (!isInvalidPreviewUrl(previewUrl)) return previewUrl;
  if (version?.sourceKind === 'html5_zip') return '';
  const publicUrl = String(version?.publicUrl || '').trim();
  return isInvalidPreviewUrl(publicUrl) ? '' : publicUrl;
}

export function resolveCreativePreviewKind(version: CreativeVersion | null | undefined) {
  const sourceKind = String(version?.sourceKind || '').trim().toLowerCase();
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const previewUrl = resolveCreativePreviewHref(version).toLowerCase();
  if (
    sourceKind === 'video_mp4' ||
    mimeType.startsWith('video/') ||
    previewUrl.endsWith('.mp4') ||
    previewUrl.endsWith('.webm') ||
    previewUrl.endsWith('.mov')
  ) {
    return 'video' as const;
  }
  return 'html' as const;
}
