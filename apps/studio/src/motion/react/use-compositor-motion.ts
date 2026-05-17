import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { WidgetMotion } from '../../domain/document/types';
import { buildCompositorMotionSpec, toKeyframeAnimationOptions } from '../compositor-motion';

type UseCompositorMotionOptions = {
  ref: RefObject<HTMLElement | null>;
  motion?: WidgetMotion;
  active?: boolean;
};

export function useCompositorMotion({
  ref,
  motion,
  active = false,
}: UseCompositorMotionOptions): void {
  const animationRef = useRef<Animation | null>(null);
  const motionSignature = JSON.stringify(motion ?? null);

  useLayoutEffect(() => {
    const node = ref.current;
    const currentAnimation = animationRef.current;
    const spec = buildCompositorMotionSpec(motion);
    if (!active || !node || !spec || typeof node.animate !== 'function') {
      currentAnimation?.cancel();
      animationRef.current = null;
      return;
    }

    currentAnimation?.cancel();
    const previousWillChange = node.style.willChange;
    if (spec.willChange) {
      node.style.willChange = spec.willChange;
    }
    const animation = node.animate(spec.keyframes, toKeyframeAnimationOptions(spec.options));
    animationRef.current = animation;

    return () => {
      animation.cancel();
      node.style.willChange = previousWillChange;
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [active, motionSignature, ref]);
}
