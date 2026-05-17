import { describe, expect, it } from 'vitest';
import { DEFAULT_SHADOW, readShadowFromStyle, shadowConfigToBoxShadow, shadowConfigToTextShadow } from '../../../shared/style/shadow';

describe('shadow helpers', () => {
  it('returns none when shadow is undefined', () => {
    expect(shadowConfigToBoxShadow(undefined)).toBe('none');
    expect(shadowConfigToTextShadow(undefined)).toBe('none');
  });

  it('returns none when disabled', () => {
    expect(shadowConfigToBoxShadow({ ...DEFAULT_SHADOW, enabled: false })).toBe('none');
  });

  it('builds box-shadow with spread and inset', () => {
    expect(shadowConfigToBoxShadow({
      enabled: true,
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      spread: 1,
      color: 'rgba(0,0,0,0.5)',
      inset: true,
    })).toBe('inset 2px 4px 8px 1px rgba(0,0,0,0.5)');
  });

  it('text-shadow omits spread and inset', () => {
    expect(shadowConfigToTextShadow({
      enabled: true,
      offsetX: 2,
      offsetY: 4,
      blur: 8,
      spread: 99,
      color: '#000',
      inset: true,
    })).toBe('2px 4px 8px #000');
  });

  it('readShadowFromStyle is tolerant to garbage', () => {
    const result = readShadowFromStyle({ shadow: { offsetX: 'NaN', enabled: 'yes' } });
    expect(result.enabled).toBe(true);
    expect(result.offsetX).toBe(DEFAULT_SHADOW.offsetX);
  });
});
