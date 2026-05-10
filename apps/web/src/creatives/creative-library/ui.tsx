import React from 'react';
import { Badge, type MetricTone } from '../../system';
import type { Creative, CreativeSizeVariant, CreativeVersion } from '../catalog';
import type { CreativeStatus, IconProps, OperationalSignal, Tone, TrendDirection } from './types';

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

export const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const CreativeIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="m7 15 3-3 3 3 2-2 3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="15.5" cy="9.5" r="1.2" fill="currentColor" />
  </svg>
);

export const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const MoreIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="5" cy="12" r="1" fill="currentColor" />
    <circle cx="12" cy="12" r="1" fill="currentColor" />
    <circle cx="19" cy="12" r="1" fill="currentColor" />
  </svg>
);

function creativeStatusTone(status: CreativeStatus) {
  const map: Record<CreativeStatus, React.ComponentProps<typeof Badge>['tone']> = {
    Live: 'success',
    Publishing: 'info',
    'Needs attention': 'critical',
    Inactive: 'neutral',
    'Preview unavailable': 'warning',
  };
  return map[status];
}

function operationalSignalTone(signal: OperationalSignal) {
  const map: Record<OperationalSignal, React.ComponentProps<typeof Badge>['tone']> = {
    Ready: 'success',
    Publishing: 'info',
    'Needs attention': 'critical',
    Inactive: 'neutral',
  };
  return map[signal];
}

export function CreativeStatusBadge({ status }: { status: CreativeStatus }) {
  return <Badge tone={creativeStatusTone(status)}>{status}</Badge>;
}

export function OperationalSignalBadge({ signal }: { signal: OperationalSignal }) {
  return <Badge tone={operationalSignalTone(signal)}>{signal}</Badge>;
}

export function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const tone: React.ComponentProps<typeof Badge>['tone'] =
    direction === 'up' ? 'success' : direction === 'down' ? 'critical' : 'neutral';
  return <Badge tone={tone}>{value}</Badge>;
}

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

export function statusBadge(status?: string) {
  const map: Record<string, React.ComponentProps<typeof Badge>['tone']> = {
    draft: 'neutral',
    pending_review: 'warning',
    approved: 'success',
    rejected: 'critical',
    published: 'info',
    validated: 'success',
    failed: 'critical',
    processing: 'info',
    queued: 'warning',
    unavailable: 'neutral',
    uploaded: 'neutral',
  };
  return <Badge tone={map[status ?? 'draft'] ?? map.draft} className="capitalize">{(status ?? 'draft').replace(/_/g, ' ')}</Badge>;
}

export function readinessBadge(variant: CreativeSizeVariant) {
  const ready = Boolean(variant.publicUrl) && (variant.status === 'active' || variant.status === 'draft' || variant.status === 'paused');
  return (
    <Badge tone={ready ? 'success' : 'neutral'}>{ready ? 'Ready' : 'Needs artifact'}</Badge>
  );
}

export function formatVideoBitrate(value?: number | null) {
  if (!value) return '—';
  return `${Math.round(value)} kbps`;
}

export function resolveCreativePreviewHref(
  creative: Creative | null | undefined,
  version: CreativeVersion | null | undefined,
) {
  const sourceKind = String(version?.sourceKind || '').trim().toLowerCase();
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const allowsIngestionArtifactPreview = (
    sourceKind === 'video_mp4'
    || mimeType.startsWith('video/')
  );
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
  if (!isInvalidPreviewUrl(publicUrl)) return publicUrl;
  const creativePreviewUrl = String(creative?.previewUrl || '').trim();
  if (!isInvalidPreviewUrl(creativePreviewUrl)) return creativePreviewUrl;
  const thumbnailUrl = String(creative?.thumbnailUrl || '').trim();
  return isInvalidPreviewUrl(thumbnailUrl) ? '' : thumbnailUrl;
}

export function resolveCreativePreviewKind(
  creative: Creative | null | undefined,
  version: CreativeVersion | null | undefined,
) {
  const mimeType = String(version?.mimeType || '').trim().toLowerCase();
  const previewUrl = resolveCreativePreviewHref(creative, version).toLowerCase();
  if (
    previewUrl.endsWith('.jpg')
    || previewUrl.endsWith('.jpeg')
    || previewUrl.endsWith('.png')
    || previewUrl.endsWith('.gif')
    || previewUrl.endsWith('.webp')
    || previewUrl.endsWith('.avif')
    || mimeType.startsWith('image/')
  ) {
    return 'image' as const;
  }
  if (
    mimeType.startsWith('video/') ||
    previewUrl.endsWith('.mp4') ||
    previewUrl.endsWith('.webm') ||
    previewUrl.endsWith('.mov')
  ) {
    return 'video' as const;
  }
  return 'html' as const;
}

export function mapMetricTone(tone: Tone): MetricTone {
  switch (tone) {
    case 'fuchsia':
      return 'brand';
    case 'emerald':
      return 'success';
    case 'amber':
      return 'warning';
    case 'rose':
      return 'critical';
    case 'sky':
      return 'info';
    default:
      return 'neutral';
  }
}
