import { describe, expect, it } from 'vitest';
import { defaultsFromWidgetSchema, validateWidgetSchemaValue } from '../../../domain/widget-schema';
import { TikTokVideoDefinition } from '../../../widgets/modules/definitions/tiktok-video.definition';
import { TIKTOK_VIDEO_DEFAULT_PROPS } from '../../../widgets/modules/tiktok-video.shared';
import { tiktokVideoSchema } from '../../../widgets/modules/tiktok-video/schema';

describe('tiktok video schema', () => {
  it('matches the historical default props byte-for-byte', () => {
    expect(defaultsFromWidgetSchema(tiktokVideoSchema)).toEqual(TIKTOK_VIDEO_DEFAULT_PROPS);
    expect(TikTokVideoDefinition.defaults('scene_1', 1).props).toEqual(TIKTOK_VIDEO_DEFAULT_PROPS);
  });

  it('keeps valid props untouched', () => {
    const result = validateWidgetSchemaValue(tiktokVideoSchema, {
      ...TIKTOK_VIDEO_DEFAULT_PROPS,
      username: 'brand.live',
      ctaLabel: 'Watch now',
    });

    expect(result.valid).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.value.username).toBe('brand.live');
    expect(result.value.ctaLabel).toBe('Watch now');
  });

  it('fills missing props from schema defaults', () => {
    const result = validateWidgetSchemaValue(tiktokVideoSchema, {
      videoSrc: 'https://cdn.example.com/video.mp4',
    });

    expect(result.value.username).toBe(TIKTOK_VIDEO_DEFAULT_PROPS.username);
    expect(result.value.caption).toBe(TIKTOK_VIDEO_DEFAULT_PROPS.caption);
    expect(result.value.videoSrc).toBe('https://cdn.example.com/video.mp4');
  });

  it('coerces booleans from string form', () => {
    const result = validateWidgetSchemaValue(tiktokVideoSchema, {
      showVerified: 'false',
      showHearts: '1',
    });

    expect(result.value.showVerified).toBe(false);
    expect(result.value.showHearts).toBe(true);
  });

  it('preserves forward-compatible extra props', () => {
    const result = validateWidgetSchemaValue(tiktokVideoSchema, {
      moderationTag: 'legal-approved',
    } as Record<string, unknown>);

    expect(result.value.moderationTag).toBe('legal-approved');
  });
});
