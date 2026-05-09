import { useEffect, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { resolveFontAssetFamily } from '../../../assets/font-family';
import type { AssetRecord } from '../../../assets/types';

export function buildFontAssetPreviewStyle(asset: AssetRecord): CSSProperties {
  return { fontFamily: resolveFontAssetFamily(asset) };
}

export function buildAssetDerivativeProgressStyle(progress: number): CSSProperties {
  return { width: `${progress}%` };
}

export function formatAssetMetaBytes(sizeBytes?: number): string | null {
  if (!sizeBytes || Number.isNaN(sizeBytes)) return null;
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatAssetDimensions(width?: number, height?: number): string | null {
  if (!width || !height) return null;
  return `${width}×${height}`;
}

export function formatAssetDuration(durationMs?: number): string | null {
  if (!durationMs || Number.isNaN(durationMs)) return null;
  const seconds = Math.max(1, Math.round(durationMs / 1000));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return minutes ? `${minutes}:${remaining.toString().padStart(2, '0')}` : `${seconds}s`;
}

export function formatProcessingLabel(asset: AssetRecord): string | null {
  if (!asset.processingStatus) return null;
  return asset.processingStatus.replace(/-/g, ' ');
}

export function describeAvailableDerivatives(asset: AssetRecord): string[] {
  const labels: string[] = [];
  if (asset.derivatives?.low?.src) labels.push('low');
  if (asset.derivatives?.mid?.src) labels.push('mid');
  if (asset.derivatives?.high?.src) labels.push('high');
  if (asset.derivatives?.thumbnail?.src) labels.push('thumb');
  if (asset.derivatives?.poster?.src) labels.push('poster');
  return labels;
}

function describeExpectedDerivatives(asset: AssetRecord): string[] {
  if (asset.kind === 'image' && asset.storageMode === 'object-storage') return ['low', 'mid', 'high', 'thumb'];
  if (asset.kind === 'video' && asset.storageMode === 'object-storage') return ['low', 'mid', 'high', 'poster'];
  return [];
}

export function describeMissingDerivatives(asset: AssetRecord): string[] {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return [];
  return expected.filter((label) => {
    if (label === 'low') return !asset.derivatives?.low?.src;
    if (label === 'mid') return !asset.derivatives?.mid?.src;
    if (label === 'high') return !asset.derivatives?.high?.src;
    if (label === 'thumb') return !asset.derivatives?.thumbnail?.src;
    if (label === 'poster') return !asset.derivatives?.poster?.src;
    return false;
  });
}

export function resolveDerivativeProgress(asset: AssetRecord): number | null {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return null;
  const available = expected.length - describeMissingDerivatives(asset).length;
  if (asset.processingStatus === 'completed') return 100;
  if (asset.processingStatus === 'failed' || asset.processingStatus === 'blocked') return Math.round((available / expected.length) * 100);
  if (asset.processingStatus === 'planned') return Math.max(10, Math.round((available / expected.length) * 100));
  if (asset.processingStatus === 'queued') return Math.max(5, Math.round((available / expected.length) * 100));
  if (asset.processingStatus === 'processing') return Math.max(20, Math.round((available / expected.length) * 100));
  return available ? Math.round((available / expected.length) * 100) : null;
}

export function canReprocessAsset(asset: AssetRecord | undefined): boolean {
  if (!asset) return false;
  if (asset.storageMode !== 'object-storage') return false;
  if (asset.processingStatus !== 'blocked' && asset.processingStatus !== 'failed') return false;
  if (asset.kind === 'video') return true;
  return asset.kind === 'image' && ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(String(asset.mimeType || '').trim().toLowerCase());
}

export function buildProcessingHistory(asset: AssetRecord): Array<{ label: string; at?: string; detail?: string }> {
  const items: Array<{ label: string; at?: string; detail?: string }> = [
    {
      label: 'Asset created',
      at: asset.createdAt,
      detail: asset.processingStatus ? `Current status: ${asset.processingStatus}` : undefined,
    },
  ];
  if (typeof asset.processingAttempts === 'number' && asset.processingAttempts > 0) {
    items.push({
      label: `Processing attempt ${asset.processingAttempts}`,
      at: asset.processingLastRetryAt ?? undefined,
      detail: asset.processingMessage || undefined,
    });
  }
  if (asset.processingNextRetryAt) {
    items.push({
      label: 'Next automatic retry',
      at: asset.processingNextRetryAt,
      detail: 'Scheduled by worker backoff',
    });
  }
  if (asset.processingStatus === 'completed') {
    items.push({
      label: 'Derivatives ready',
      detail: 'Remote derivatives completed successfully',
    });
  }
  if (asset.processingStatus === 'failed') {
    items.push({
      label: 'Processing failed',
      detail: asset.processingMessage || 'Retries exhausted',
    });
  }
  if (asset.processingStatus === 'blocked') {
    items.push({
      label: 'Processing blocked',
      detail: asset.processingMessage || 'Worker requirements are missing',
    });
  }
  return items;
}

export function hasRemoteDerivativeReadiness(asset: AssetRecord): boolean {
  const expected = describeExpectedDerivatives(asset);
  if (!expected.length) return false;
  return describeMissingDerivatives(asset).length === 0;
}

export function assetPreview(asset: AssetRecord, previewUrl: string): JSX.Element {
  if (asset.kind === 'image') return <img src={previewUrl} alt={asset.name} className="asset-preview-media" />;
  if (asset.kind === 'video') return <video src={previewUrl} poster={asset.derivatives?.poster?.src ?? asset.posterSrc} muted className="asset-preview-media" />;
  if (asset.kind === 'font') return <div className="asset-preview-fallback asset-preview-fallback--font" style={buildFontAssetPreviewStyle(asset)}>Aa</div>;
  return <div className="asset-preview-fallback">FILE</div>;
}

export function useRenameDraft(asset?: AssetRecord): [string, Dispatch<SetStateAction<string>>] {
  const [value, setValue] = useState(asset?.name ?? '');
  useEffect(() => {
    setValue(asset?.name ?? '');
  }, [asset?.id, asset?.name]);
  return [value, setValue];
}
