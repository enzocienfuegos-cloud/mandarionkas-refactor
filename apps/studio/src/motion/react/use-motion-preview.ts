import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';
import { toKeyframeAnimationOptions } from '../compositor-motion';

function buildTemplatePreview(template: MotionTemplate, config: MotionConfig): {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
} {
  const compositorMotion = template.buildCompositorMotion(config);
  return {
    keyframes: compositorMotion.keyframes,
    options: toKeyframeAnimationOptions(compositorMotion.options),
  };
}

type UseMotionPreviewOptions = {
  ref: RefObject<HTMLElement | null>;
  template?: MotionTemplate;
  config?: MotionConfig;
  baseOpacity?: number;
  active?: boolean;
  scrubTimeMs?: number | null;
};

export function useMotionPreview({
  ref,
  template,
  config,
  active = false,
  scrubTimeMs,
}: UseMotionPreviewOptions): void {
  const animationRef = useRef<Animation | null>(null);
  const configSignature = JSON.stringify(config ?? null);
  const scrubActive = typeof scrubTimeMs === 'number';

  useLayoutEffect(() => {
    const node = ref.current;
    const currentAnimation = animationRef.current;
    const shouldRenderPreview = active || scrubActive;
    if (!shouldRenderPreview || !node || !template || !config || typeof node.animate !== 'function') {
      currentAnimation?.cancel();
      animationRef.current = null;
      return;
    }

    currentAnimation?.cancel();
    const preview = buildTemplatePreview(template, config);
    const animation = node.animate(preview.keyframes, preview.options);
    animation.pause();
    animationRef.current = animation;

    return () => {
      animation.cancel();
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [active, configSignature, ref, scrubActive, template]);

  useLayoutEffect(() => {
    const animation = animationRef.current;
    if (!animation) return;

    if (typeof scrubTimeMs === 'number') {
      animation.pause();
      animation.currentTime = Math.max(0, scrubTimeMs);
      return;
    }

    if (active) {
      if (animation.playState !== 'running') {
        animation.play();
      }
      return;
    }

    animation.pause();
    animation.currentTime = 0;
  }, [active, scrubTimeMs]);
}
