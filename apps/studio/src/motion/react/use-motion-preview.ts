import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import gsap from 'gsap';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';

function normalizePreviewVars(frame: Record<string, unknown> | undefined): Record<string, string | number> {
  const nextVars: Record<string, string | number> = {};
  Object.entries(frame ?? {}).forEach(([key, value]) => {
    if (key === 'offset' || value == null) return;
    nextVars[key] = value as string | number;
  });
  return nextVars;
}

function buildPreviewTimeline(
  node: HTMLElement,
  template: MotionTemplate,
  config: MotionConfig,
): gsap.core.Timeline | null {
  const compositorMotion = template.buildCompositorMotion(config);
  const keyframes = compositorMotion.keyframes;
  if (!keyframes.length) return null;

  const durationSec = Math.max(0, Number(compositorMotion.options?.duration ?? 700)) / 1000;
  const delaySec = Math.max(0, Number(compositorMotion.options?.delay ?? 0)) / 1000;
  const repeat = compositorMotion.options?.iterations === 'infinite'
    ? -1
    : Math.max(0, Number(compositorMotion.options?.iterations ?? 1) - 1);
  const ease = typeof compositorMotion.options?.easing === 'string' && compositorMotion.options.easing.length
    ? compositorMotion.options.easing
    : 'power2.out';
  const timeline = gsap.timeline({ paused: true, repeat });
  const lastOffsetIndex = Math.max(1, keyframes.length - 1);

  timeline.set(node, normalizePreviewVars(keyframes[0]), 0);

  for (let index = 1; index < keyframes.length; index += 1) {
    const previousFrame = keyframes[index - 1];
    const nextFrame = keyframes[index];
    const previousOffset = typeof previousFrame?.offset === 'number' ? previousFrame.offset : (index - 1) / lastOffsetIndex;
    const nextOffset = typeof nextFrame?.offset === 'number' ? nextFrame.offset : index / lastOffsetIndex;
    const segmentDuration = Math.max(0, (nextOffset - previousOffset) * durationSec);
    timeline.to(node, {
      ...normalizePreviewVars(nextFrame),
      duration: segmentDuration,
      ease,
      overwrite: 'auto',
      force3D: true,
    }, delaySec + previousOffset * durationSec);
  }

  return timeline;
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
  const timelineRef = useRef<gsap.core.Timeline | null>(null);
  const configSignature = JSON.stringify(config ?? null);
  const scrubActive = typeof scrubTimeMs === 'number';
  const shouldRenderPreview = active || scrubActive;

  useLayoutEffect(() => {
    const node = ref.current;
    timelineRef.current?.kill();
    timelineRef.current = null;

    if (!shouldRenderPreview || !node || !template || !config) {
      return;
    }

    const timeline = buildPreviewTimeline(node, template, config);
    if (!timeline) return;
    timeline.pause(0);
    timelineRef.current = timeline;

    return () => {
      timeline.kill();
      if (timelineRef.current === timeline) {
        timelineRef.current = null;
      }
    };
  }, [configSignature, ref, shouldRenderPreview, template]);

  useLayoutEffect(() => {
    const timeline = timelineRef.current;
    if (!timeline) return;

    if (typeof scrubTimeMs === 'number') {
      timeline.pause();
      timeline.seek(Math.max(0, scrubTimeMs) / 1000);
      return;
    }

    if (active) {
      if (!timeline.isActive()) {
        timeline.play();
      }
      return;
    }

    timeline.pause(0);
  }, [active, scrubTimeMs]);
}
