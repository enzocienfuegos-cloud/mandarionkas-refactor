import { describe, expect, it } from 'vitest';
import { getPreviewFrame, PREVIEW_FRAMES } from '../../../domain/preview/preview-frames';

describe('preview frame catalog', () => {
  it('keeps the expected built-in preview contexts available', () => {
    expect(PREVIEW_FRAMES.map((frame) => frame.id)).toEqual(['none', 'iphone14', 'pixel8', 'article']);
  });

  it('falls back to the plain frame when an unknown id is requested', () => {
    expect(getPreviewFrame(undefined).id).toBe('none');
  });

  it('defines placement bounds for framed previews', () => {
    const framed = PREVIEW_FRAMES.filter((frame) => frame.id !== 'none');
    expect(framed.every((frame) => frame.placement.width > 0 && frame.placement.height > 0)).toBe(true);
  });
});
