import { describe, expect, it } from 'vitest';
import { selectBestMediaFile } from '../media-selector.js';

describe('selectBestMediaFile', () => {
  it('prefers HLS when supported', () => {
    const selected = selectBestMediaFile([
      { src: 'https://cdn.example.com/video.mp4', type: 'video/mp4', delivery: 'progressive', bitrate: 1200, width: 640, height: 360 },
      { src: 'https://cdn.example.com/manifest.m3u8', type: 'application/x-mpegURL', delivery: 'streaming' },
    ], { supportsHLS: true });
    expect(selected?.type).toBe('application/x-mpegURL');
  });

  it('falls back to best mp4 when HLS is unavailable', () => {
    const selected = selectBestMediaFile([
      { src: 'https://cdn.example.com/video-small.mp4', type: 'video/mp4', delivery: 'progressive', bitrate: 700, width: 640, height: 360 },
      { src: 'https://cdn.example.com/video-large.mp4', type: 'video/mp4', delivery: 'progressive', bitrate: 1200, width: 1280, height: 720 },
    ], { supportsHLS: false, viewportWidth: 800, viewportHeight: 450, maxBitrateKbps: 1500 });
    expect(selected?.src).toContain('video-large');
  });
});
