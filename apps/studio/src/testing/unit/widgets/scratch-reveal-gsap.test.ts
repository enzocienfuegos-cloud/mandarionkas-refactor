/** @vitest-environment jsdom */
import gsap from 'gsap';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { runScratchRevealRevealAnimation } from '../../../widgets/modules/scratch-reveal.renderer';

describe('scratch reveal gsap animation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses gsap.fromTo instead of Element.animate for reveal playback', () => {
    const image = {} as HTMLImageElement;
    const animateSpy = vi.fn();
    Object.defineProperty(image, 'animate', {
      configurable: true,
      value: animateSpy,
    });
    const killTweensOfSpy = vi.spyOn(gsap, 'killTweensOf').mockImplementation(() => undefined);
    const fromToSpy = vi.spyOn(gsap, 'fromTo').mockImplementation(() => ({}) as gsap.core.Tween);

    runScratchRevealRevealAnimation(image, 'fade-up', 900, 250);

    expect(killTweensOfSpy).toHaveBeenCalledWith(image);
    expect(fromToSpy).toHaveBeenCalledTimes(1);
    expect(animateSpy).not.toHaveBeenCalled();
  });
});
