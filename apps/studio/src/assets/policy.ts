import type { ReleaseTarget } from '../domain/document/types';
import type { AssetDerivative, AssetQualityPreference, AssetQualityTier, AssetRecord } from './types';

export type AssetOptimizationPolicy = {
  targetChannel: ReleaseTarget;
  maxInitialAssetBytes: number;
  maxVideoBitrateKbps: number;
  preferredImageTier: AssetQualityTier;
  preferredVideoTier: AssetQualityTier;
  requireVideoPoster: boolean;
  allowRemoteOriginals: boolean;
};

const DEFAULT_POLICY: AssetOptimizationPolicy = {
  targetChannel: 'generic-html5',
  maxInitialAssetBytes: 200 * 1024,
  maxVideoBitrateKbps: 1800,
  preferredImageTier: 'mid',
  preferredVideoTier: 'mid',
  requireVideoPoster: false,
  allowRemoteOriginals: true,
};

const CHANNEL_POLICIES: Record<ReleaseTarget, AssetOptimizationPolicy> = {
  'generic-html5': {
    ...DEFAULT_POLICY,
    targetChannel: 'generic-html5',
    maxInitialAssetBytes: 200 * 1024,
    preferredImageTier: 'mid',
    preferredVideoTier: 'mid',
  },
  'google-display': {
    ...DEFAULT_POLICY,
    targetChannel: 'google-display',
    maxInitialAssetBytes: 150 * 1024,
    maxVideoBitrateKbps: 1400,
    preferredImageTier: 'low',
    preferredVideoTier: 'low',
  },
  'gam-html5': {
    ...DEFAULT_POLICY,
    targetChannel: 'gam-html5',
    maxInitialAssetBytes: 180 * 1024,
    maxVideoBitrateKbps: 1600,
    preferredImageTier: 'mid',
    preferredVideoTier: 'mid',
    requireVideoPoster: true,
  },
  mraid: {
    ...DEFAULT_POLICY,
    targetChannel: 'mraid',
    maxInitialAssetBytes: 120 * 1024,
    maxVideoBitrateKbps: 1200,
    preferredImageTier: 'low',
    preferredVideoTier: 'low',
    requireVideoPoster: true,
    allowRemoteOriginals: false,
  },
  'meta-story': {
    ...DEFAULT_POLICY,
    targetChannel: 'meta-story',
    maxInitialAssetBytes: 300 * 1024,
    maxVideoBitrateKbps: 2200,
    preferredImageTier: 'high',
    preferredVideoTier: 'high',
    requireVideoPoster: true,
  },
  'tiktok-vertical': {
    ...DEFAULT_POLICY,
    targetChannel: 'tiktok-vertical',
    maxInitialAssetBytes: 300 * 1024,
    maxVideoBitrateKbps: 2200,
    preferredImageTier: 'high',
    preferredVideoTier: 'high',
    requireVideoPoster: true,
  },
};

function pickDerivativeFromTier(asset: AssetRecord, tier: AssetQualityTier): AssetDerivative | undefined {
  return asset.derivatives?.[tier];
}

export function getAssetOptimizationPolicy(targetChannel: ReleaseTarget): AssetOptimizationPolicy {
  return CHANNEL_POLICIES[targetChannel] ?? DEFAULT_POLICY;
}

export function resolveAssetQualityPreference(asset: AssetRecord, targetChannel: ReleaseTarget, preferredQuality: AssetQualityPreference = 'auto'): AssetQualityTier {
  if (preferredQuality !== 'auto') return preferredQuality;
  const policy = getAssetOptimizationPolicy(targetChannel);
  return asset.kind === 'video' ? policy.preferredVideoTier : policy.preferredImageTier;
}

export function selectAssetDerivative(
  asset: AssetRecord,
  targetChannel: ReleaseTarget,
  preferredQuality: AssetQualityPreference = asset.qualityPreference ?? 'auto',
): AssetDerivative | undefined {
  const resolvedTier = resolveAssetQualityPreference(asset, targetChannel, preferredQuality);
  const preferred = pickDerivativeFromTier(asset, resolvedTier);
  if (preferred) return preferred;
  return (
    asset.derivatives?.mid
    ?? asset.derivatives?.high
    ?? asset.derivatives?.low
    ?? asset.derivatives?.original
    ?? (asset.posterSrc ? { src: asset.posterSrc } : undefined)
  );
}

export function resolveAssetDeliveryUrl(
  asset: AssetRecord,
  targetChannel: ReleaseTarget,
  preferredQuality: AssetQualityPreference = asset.qualityPreference ?? 'auto',
): string {
  const derived = selectAssetDerivative(asset, targetChannel, preferredQuality);
  return derived?.src ?? asset.optimizedUrl ?? asset.publicUrl ?? asset.src;
}

export function assetViolatesChannelPolicy(asset: AssetRecord, targetChannel: ReleaseTarget): string[] {
  const policy = getAssetOptimizationPolicy(targetChannel);
  const issues: string[] = [];
  const selected = selectAssetDerivative(asset, targetChannel);
  const estimatedBytes = selected?.sizeBytes ?? asset.sizeBytes;

  if (estimatedBytes && estimatedBytes > policy.maxInitialAssetBytes) {
    issues.push(`Asset exceeds the ${targetChannel} initial-weight budget.`);
  }
  if (asset.kind === 'video') {
    if (policy.requireVideoPoster && !asset.posterSrc && !asset.derivatives?.poster?.src) {
      issues.push(`Video assets exported to ${targetChannel} should include a poster.`);
    }
    if (selected?.bitrateKbps && selected.bitrateKbps > policy.maxVideoBitrateKbps) {
      issues.push(`Video bitrate exceeds the ${targetChannel} delivery budget.`);
    }
  }
  if (!policy.allowRemoteOriginals && asset.storageMode === 'remote-url' && !selected?.src && !asset.optimizedUrl) {
    issues.push(`${targetChannel} should not rely on remote original asset URLs.`);
  }

  return issues;
}
