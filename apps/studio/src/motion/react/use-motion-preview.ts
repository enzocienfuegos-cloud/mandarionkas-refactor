import { useLayoutEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { MotionConfig, MotionTemplate } from '../motion-template-contract';
import { readConfigNumber } from '../motion-engine';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getPreviewDuration(template: MotionTemplate, config: MotionConfig): number {
  const durationMs = Math.max(120, readConfigNumber(config, 'durationMs', 700));
  const delayMs = Math.max(0, readConfigNumber(config, 'delayMs', 0));
  if (template.category === 'loop') return delayMs + durationMs;
  if (template.category === 'exit') return durationMs;
  return delayMs + durationMs;
}

function buildHoverPreview(template: MotionTemplate, config: MotionConfig, baseOpacity: number): {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
} {
  const durationMs = Math.max(120, readConfigNumber(config, 'durationMs', 240));
  if (template.id === 'lift') {
    const distancePx = Math.max(1, readConfigNumber(config, 'distancePx', 12));
    return {
      keyframes: [
        { transform: 'translateY(0px)', opacity: baseOpacity, offset: 0 },
        { transform: `translateY(-${distancePx}px)`, opacity: baseOpacity, offset: 1 },
      ],
      options: { duration: durationMs, easing: 'ease-out', iterations: 1, fill: 'both' },
    };
  }
  if (template.id === 'zoom') {
    const scale = Math.max(1.01, readConfigNumber(config, 'scale', 1.05));
    return {
      keyframes: [
        { transform: 'scale(1)', opacity: baseOpacity, offset: 0 },
        { transform: `scale(${scale})`, opacity: baseOpacity, offset: 1 },
      ],
      options: { duration: durationMs, easing: 'ease-out', iterations: 1, fill: 'both' },
    };
  }
  return {
    keyframes: [
      { opacity: baseOpacity, offset: 0 },
      { opacity: baseOpacity * 0.7, offset: 0.5 },
      { opacity: baseOpacity, offset: 1 },
    ],
    options: { duration: Math.max(300, durationMs), easing: 'ease-in-out', iterations: Number.POSITIVE_INFINITY, fill: 'both' },
  };
}

function evaluateTrack(property: 'x' | 'y' | 'opacity', keyframes: Array<{ atMs: number; property: string; value: number; easing?: string }>, atMs: number, fallback: number): number {
  const track = keyframes.filter((keyframe) => keyframe.property === property).sort((left, right) => left.atMs - right.atMs);
  if (!track.length) return fallback;
  const before = [...track].reverse().find((keyframe) => keyframe.atMs <= atMs) ?? track[0];
  const after = track.find((keyframe) => keyframe.atMs >= atMs) ?? track[track.length - 1];
  if (before.atMs === after.atMs) return before.value;
  const progress = clamp((atMs - before.atMs) / Math.max(1, after.atMs - before.atMs), 0, 1);
  const easing = after.easing ?? 'linear';
  const eased = easing === 'ease-in'
    ? progress * progress
    : easing === 'ease-out'
      ? 1 - (1 - progress) * (1 - progress)
      : easing === 'ease-in-out'
        ? (progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2)
        : progress;
  return before.value + (after.value - before.value) * eased;
}

function buildTemplatePreview(template: MotionTemplate, config: MotionConfig, baseOpacity: number): {
  keyframes: Keyframe[];
  options: KeyframeAnimationOptions;
} {
  if (template.category === 'hover') {
    return buildHoverPreview(template, config, baseOpacity);
  }
  const previewDurationMs = getPreviewDuration(template, config);
  const previewFrame = { x: 0, y: 0, width: 72, height: 24, rotation: 0 };
  const timeline = { startMs: 0, endMs: Math.max(previewDurationMs, 1) };
  const generated = template.buildKeyframes(config, previewFrame, timeline);
  const sampleCount = 16;
  const keyframes = Array.from({ length: sampleCount + 1 }, (_, index) => {
    const atMs = (previewDurationMs * index) / sampleCount;
    const x = evaluateTrack('x', generated, atMs, previewFrame.x) - previewFrame.x;
    const y = evaluateTrack('y', generated, atMs, previewFrame.y) - previewFrame.y;
    const opacity = evaluateTrack('opacity', generated, atMs, baseOpacity);
    return {
      transform: `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`,
      opacity,
      offset: index / sampleCount,
    };
  });
  return {
    keyframes,
    options: {
      duration: previewDurationMs,
      easing: 'linear',
      iterations: template.category === 'loop' ? Number.POSITIVE_INFINITY : 1,
      fill: 'both',
    },
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
  baseOpacity = 1,
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
    const preview = buildTemplatePreview(template, config, baseOpacity);
    const animation = node.animate(preview.keyframes, preview.options);
    animation.pause();
    animationRef.current = animation;

    return () => {
      animation.cancel();
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
    };
  }, [baseOpacity, configSignature, ref, template]);

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
