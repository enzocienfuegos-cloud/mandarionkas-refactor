import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('system animations', () => {
  it('registers global keyframes in the shared stylesheet', () => {
    const styles = readFileSync(`${process.cwd()}/src/system/tokens.css`, 'utf8');
    expect(styles).toContain('@keyframes duskFadeIn');
    expect(styles).toContain('@keyframes duskScaleIn');
    expect(styles).toContain('@keyframes duskSlideInRight');
    expect(styles).toContain('@keyframes duskSlideInLeft');
    expect(styles).toContain('@keyframes duskToastIn');
    expect(styles).toContain('@keyframes duskSlideUpFromBottom');
  });
});
