import type { MotionConfig, MotionConfigField } from './motion-template-contract';
import type { AnimationClock, AnimationPlan } from './animation-clocks';
import { resolveClockLocalMs } from './animation-clocks';

export type AnimationEnginePlayback = {
  cancel: () => void;
};

export type AnimationEngineAdapter = {
  play: (
    node: Element,
    keyframes: Keyframe[],
    options: KeyframeAnimationOptions,
    context: { plan: AnimationPlan; clock: AnimationClock; sceneTimeMs: number; timelineStartMs?: number },
  ) => AnimationEnginePlayback | null;
};

export const waapiAnimationAdapter: AnimationEngineAdapter = {
  play(node, keyframes, options, context) {
    if (typeof node.animate !== 'function') return null;
    const animation = node.animate(keyframes, options);
    animation.currentTime = resolveClockLocalMs(context.clock, context.sceneTimeMs, context.timelineStartMs ?? 0);
    return {
      cancel: () => animation.cancel(),
    };
  },
};

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function readConfigNumber(config: MotionConfig, key: string, fallback: number): number {
  const value = config[key];
  const numeric = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : Number.NaN;
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function readConfigString(config: MotionConfig, key: string, fallback: string): string {
  const value = config[key];
  return typeof value === 'string' && value.trim().length ? value : fallback;
}

export function sanitizeMotionConfig(fields: MotionConfigField[], defaults: MotionConfig, config: MotionConfig = {}): MotionConfig {
  const nextConfig: MotionConfig = { ...defaults, ...config };
  fields.forEach((field) => {
    if (field.kind === 'number') {
      nextConfig[field.key] = clamp(readConfigNumber(config, field.key, field.defaultValue), field.min, field.max);
      return;
    }
    const fallback = typeof defaults[field.key] === 'string' ? String(defaults[field.key]) : field.defaultValue;
    const raw = readConfigString(config, field.key, fallback);
    nextConfig[field.key] = field.options.some((option) => option.value === raw) ? raw : field.defaultValue;
  });
  return nextConfig;
}
