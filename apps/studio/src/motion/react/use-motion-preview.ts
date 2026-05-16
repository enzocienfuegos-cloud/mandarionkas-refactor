import { useEffect } from 'react';
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
  useEffect(() => {
    const node = ref.current;
    if (!node || !template || !config || typeof node.animate !== 'function') return;
    const animation = node.animate(
      template.buildWAAPIKeyframes(config, baseOpacity, baseTransform),
      template.buildWAAPIOptions(config),
    );

    if (typeof scrubTimeMs === 'number') {
      animation.pause();
      animation.currentTime = Math.max(0, scrubTimeMs);
    } else if (!active) {
      animation.cancel();
      return undefined;
    }

    return () => {
      animation.cancel();
    };
  }, [active, baseOpacity, baseTransform, config, ref, scrubTimeMs, template]);
}
