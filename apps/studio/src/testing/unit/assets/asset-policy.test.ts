import { describe, expect, it } from 'vitest';
import { assetViolatesChannelPolicy, getAssetOptimizationPolicy, resolveAssetDeliveryUrl, resolveAssetQualityPreference, selectAssetDerivative } from '../../../assets/policy';
import type { AssetRecord } from '../../../assets/types';

function buildImageAsset(): AssetRecord {
  return {
    id: 'asset_img',
    name: 'Hero',
    kind: 'image',
    src: 'https://cdn.example.com/original.jpg',
    publicUrl: 'https://cdn.example.com/original.jpg',
    optimizedUrl: 'https://cdn.example.com/optimized.jpg',
    createdAt: '2026-04-18T00:00:00.000Z',
    clientId: 'client_default',
    ownerUserId: 'user_admin',
    storageMode: 'object-storage',
    derivatives: {
      low: { src: 'https://cdn.example.com/hero-low.webp', sizeBytes: 48_000, width: 600, height: 400 },
      mid: { src: 'https://cdn.example.com/hero-mid.webp', sizeBytes: 92_000, width: 1200, height: 800 },
      high: { src: 'https://cdn.example.com/hero-high.webp', sizeBytes: 188_000, width: 1800, height: 1200 },
      thumbnail: { src: 'https://cdn.example.com/hero-thumb.webp', sizeBytes: 8_000, width: 240, height: 160 },
    },
  };
}

function buildVideoAsset(): AssetRecord {
  return {
    id: 'asset_vid',
    name: 'Demo',
    kind: 'video',
    src: 'https://cdn.example.com/master.mp4',
    publicUrl: 'https://cdn.example.com/master.mp4',
    createdAt: '2026-04-18T00:00:00.000Z',
    clientId: 'client_default',
    ownerUserId: 'user_admin',
    storageMode: 'object-storage',
    derivatives: {
      low: { src: 'https://cdn.example.com/demo-low.mp4', sizeBytes: 98_000, bitrateKbps: 900, width: 360, height: 640, codec: 'h264' },
      mid: { src: 'https://cdn.example.com/demo-mid.mp4', sizeBytes: 180_000, bitrateKbps: 1500, width: 540, height: 960, codec: 'h264' },
      high: { src: 'https://cdn.example.com/demo-high.mp4', sizeBytes: 320_000, bitrateKbps: 2600, width: 720, height: 1280, codec: 'h264' },
      poster: { src: 'https://cdn.example.com/demo-poster.jpg', sizeBytes: 12_000, width: 720, height: 1280 },
    },
  };
}

describe('asset policy', () => {
  it('defines a stricter policy for mraid than generic html5', () => {
    const generic = getAssetOptimizationPolicy('generic-html5');
    const mraid = getAssetOptimizationPolicy('mraid');
    expect(mraid.maxInitialAssetBytes).toBeLessThan(generic.maxInitialAssetBytes);
    expect(mraid.preferredImageTier).toBe('low');
    expect(mraid.requireVideoPoster).toBe(true);
  });

  it('resolves auto quality by channel policy', () => {
    expect(resolveAssetQualityPreference(buildImageAsset(), 'generic-html5')).toBe('mid');
    expect(resolveAssetQualityPreference(buildImageAsset(), 'mraid')).toBe('low');
    expect(resolveAssetQualityPreference(buildVideoAsset(), 'meta-story')).toBe('high');
  });

  it('selects the right derivative and delivery url', () => {
    const image = buildImageAsset();
    expect(selectAssetDerivative(image, 'mraid')?.src).toContain('hero-low');
    expect(resolveAssetDeliveryUrl(image, 'generic-html5')).toContain('hero-mid');
    expect(resolveAssetDeliveryUrl(image, 'generic-html5', 'high')).toContain('hero-high');
  });

  it('flags assets that violate channel budgets', () => {
    const image = buildImageAsset();
    image.derivatives!.low!.sizeBytes = 180_000;
    const video = buildVideoAsset();
    delete video.derivatives!.poster;
    const imageIssues = assetViolatesChannelPolicy(image, 'mraid');
    const videoIssues = assetViolatesChannelPolicy(video, 'mraid');
    expect(imageIssues.some((issue) => issue.includes('initial-weight budget'))).toBe(true);
    expect(videoIssues.some((issue) => issue.includes('include a poster'))).toBe(true);
  });

  it('does not flag poster issues when a poster derivative exists', () => {
    const video = buildVideoAsset();
    const issues = assetViolatesChannelPolicy(video, 'mraid');
    expect(issues.some((issue) => issue.includes('include a poster'))).toBe(false);
  });
});
