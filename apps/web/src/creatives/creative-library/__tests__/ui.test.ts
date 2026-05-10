import { describe, expect, it } from 'vitest';
import { resolveCreativePreviewHref, resolveCreativePreviewKind } from '../ui';
import type { Creative, CreativeVersion } from '../../catalog';

describe('creative preview resolution', () => {
  it('treats poster fallback for video creatives as an image preview, not a playable video', () => {
    const creative = {
      id: 'creative-1',
      name: 'Poster fallback',
      format: 'vast_video',
      approvalStatus: 'draft',
      previewUrl: 'https://cdn.example.com/assets/creative-1-poster.jpg',
      thumbnailUrl: 'https://cdn.example.com/assets/creative-1-poster.jpg',
      createdAt: '2026-05-07T00:00:00.000Z',
    } satisfies Creative;

    const version = {
      id: 'version-1',
      creativeId: 'creative-1',
      versionNumber: 1,
      sourceKind: 'video_mp4',
      servingFormat: 'vast_video',
      status: 'draft',
      publicUrl: '',
      previewUrl: '',
      mimeType: 'video/mp4',
    } satisfies CreativeVersion;

    expect(resolveCreativePreviewHref(creative, version)).toBe('https://cdn.example.com/assets/creative-1-poster.jpg');
    expect(resolveCreativePreviewKind(creative, version)).toBe('image');
  });

  it('keeps mp4 previews as video when the resolved preview asset is playable', () => {
    const creative = {
      id: 'creative-2',
      name: 'Playable video',
      format: 'vast_video',
      approvalStatus: 'draft',
      createdAt: '2026-05-07T00:00:00.000Z',
    } satisfies Creative;

    const version = {
      id: 'version-2',
      creativeId: 'creative-2',
      versionNumber: 1,
      sourceKind: 'video_mp4',
      servingFormat: 'vast_video',
      status: 'draft',
      publicUrl: 'https://cdn.example.com/assets/creative-2.mp4',
      previewUrl: 'https://cdn.example.com/assets/creative-2.mp4',
      mimeType: 'video/mp4',
    } satisfies CreativeVersion;

    expect(resolveCreativePreviewHref(creative, version)).toBe('https://cdn.example.com/assets/creative-2.mp4');
    expect(resolveCreativePreviewKind(creative, version)).toBe('video');
  });
});
