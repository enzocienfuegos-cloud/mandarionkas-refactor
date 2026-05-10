import { describe, expect, it } from 'vitest';
import { createAssetDraftFromUrl, describeAssetSource, inferAssetKindFromMimeType, inferAssetKindFromUrl } from '../../../assets/pipeline';

describe('asset pipeline', () => {
  it('builds a remote asset draft with normalized metadata', async () => {
    const draft = await createAssetDraftFromUrl({ url: 'https://cdn.example.com/media/hero.png?cache=1', accessScope: 'client' });
    expect(draft.kind).toBe('image');
    expect(draft.storageMode).toBe('remote-url');
    expect(draft.sourceType).toBe('url');
    expect(draft.originUrl).toContain('hero.png');
    expect(draft.publicUrl).toContain('cdn.example.com');
    expect(draft.fingerprint).toBeTruthy();
  });

  it('describes source/storage combinations consistently', () => {
    expect(describeAssetSource('upload', 'object-storage')).toBe('upload · object-storage');
    expect(describeAssetSource(undefined, undefined)).toBe('upload · object-storage');
    expect(inferAssetKindFromUrl('https://cdn.example.com/video.mp4')).toBe('video');
    expect(inferAssetKindFromMimeType('image/png')).toBe('image');
  });
});
