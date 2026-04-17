import type { ExportAsset, ExportQualityProfile, ExportQualityProfileName } from './types';

const QUALITY_PROFILES: Record<ExportQualityProfileName, ExportQualityProfile> = {
  high: {
    id: 'high',
    label: 'High',
    description: 'Prioritizes visual fidelity and preserves source quality whenever possible.',
    imageHint: 'high',
    videoHint: 'high',
    posterHint: 'high',
    svgHint: 'source',
  },
  medium: {
    id: 'medium',
    label: 'Medium',
    description: 'Balances quality and package weight for default banner delivery.',
    imageHint: 'medium',
    videoHint: 'medium',
    posterHint: 'medium',
    svgHint: 'source',
  },
  low: {
    id: 'low',
    label: 'Low',
    description: 'Optimizes package weight and favors lighter media variants when available.',
    imageHint: 'low',
    videoHint: 'low',
    posterHint: 'low',
    svgHint: 'source',
  },
};

export function resolveExportQualityProfile(profile: ExportQualityProfileName = 'medium'): ExportQualityProfile {
  return QUALITY_PROFILES[profile] ?? QUALITY_PROFILES.medium;
}

export function resolveAssetQualityHint(
  kind: ExportAsset['kind'],
  profile: ExportQualityProfileName = 'medium',
): ExportAsset['qualityHint'] {
  const resolved = resolveExportQualityProfile(profile);
  if (kind === 'image') return resolved.imageHint;
  if (kind === 'video') return resolved.videoHint;
  if (kind === 'poster') return resolved.posterHint;
  return resolved.svgHint;
}
