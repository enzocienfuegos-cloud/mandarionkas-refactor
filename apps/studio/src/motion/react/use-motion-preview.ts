import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';

type UseMotionPreviewOptions = {
  ref: RefObject<HTMLElement | null>;
  template?: MotionTemplate;
  config?: MotionConfig;
  baseOpacity?: number;
  baseTransform?: string;
  active?: boolean;
  scrubTimeMs?: number | null;
};

export function useMotionPreview({
  ref,
  template,
  config,
  baseOpacity = 1,
  baseTransform = 'rotate(0deg)',
  active = false,
  scrubTimeMs,
}: UseMotionPreviewOptions): void {
  const animationRef = useRef<Animation | null>(null);
  const configSignature = JSON.stringify(config ?? null);

  useLayoutEffect(() => {
    const node = ref.current;
    const currentAnimation = animationRef.current;
    if (!node || !template || !config || typeof node.animate !== 'function') {
      currentAnimation?.cancel();
      animationRef.current = null;
      return;
    }

    currentAnimation?.cancel();
    const animation = node.animate(
      template.buildWAAPIKeyframes(config, baseOpacity, baseTransform),
      template.buildWAAPIOptions(config),
    );
    animation.pause();
    animationRef.current = animation;

    return () => {
      animation.cancel();
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [baseOpacity, baseTransform, configSignature, ref, template]);

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
