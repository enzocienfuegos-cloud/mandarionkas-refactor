import type { MotionCategory, MotionConfig, MotionConfigField, MotionPlaybackInput } from './motion-template-contract';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function applyEasing(progress: number, easing: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'): number {
  const clamped = clamp(progress, 0, 1);
  if (easing === 'ease-in') return clamped * clamped;
  if (easing === 'ease-out') return 1 - (1 - clamped) * (1 - clamped);
  if (easing === 'ease-in-out') return clamped < 0.5 ? 2 * clamped * clamped : 1 - Math.pow(-2 * clamped + 2, 2) / 2;
  return clamped;
}

export function normalizeOneShotProgress(elapsedMs: number, delayMs: number, durationMs: number): number {
  if (durationMs <= 0) return 1;
  return clamp((elapsedMs - delayMs) / durationMs, 0, 1);
}

export function normalizeLoopProgress(elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const normalized = ((elapsedMs % durationMs) + durationMs) % durationMs;
  return clamp(normalized / durationMs, 0, 1);
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

export function resolveMotionCurrentTime({ playheadMs, timeline, config, category }: MotionPlaybackInput): number {
  const startMs = Number(timeline.startMs ?? 0);
  const endMs = Math.max(startMs, Number(timeline.endMs ?? startMs));
  const durationMs = Math.max(120, readConfigNumber(config, 'durationMs', 700));
  const delayMs = Math.max(0, readConfigNumber(config, 'delayMs', 0));
  const effectiveDurationMs = Math.max(durationMs, 1);

  if (category === 'exit') {
    const anchorMs = Math.max(startMs, endMs - effectiveDurationMs);
    return clamp(playheadMs - anchorMs, 0, effectiveDurationMs);
  }

  if (category === 'loop') {
    const elapsedMs = playheadMs - startMs;
    if (elapsedMs <= delayMs) return 0;
    const loopTime = normalizeLoopProgress(elapsedMs - delayMs, effectiveDurationMs) * effectiveDurationMs;
    return delayMs + loopTime;
  }

  return clamp(playheadMs - startMs, 0, delayMs + effectiveDurationMs);
}

export function resolveMotionElapsedMs({ playheadMs, timeline, config, category }: MotionPlaybackInput): number {
  const startMs = Number(timeline.startMs ?? 0);
  const endMs = Math.max(startMs, Number(timeline.endMs ?? startMs));
  const durationMs = Math.max(120, readConfigNumber(config, 'durationMs', 700));

  if (category === 'exit') {
    return playheadMs - Math.max(startMs, endMs - durationMs);
  }

  return playheadMs - startMs;
}

export function mergeTransforms(baseTransform: string, extraTransform: string): string {
  return extraTransform.trim().length ? `${baseTransform} ${extraTransform}`.trim() : baseTransform;
}
