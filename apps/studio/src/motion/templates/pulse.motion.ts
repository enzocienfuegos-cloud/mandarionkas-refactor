import { createElement } from 'react';
import { applyEasing, clamp, normalizeLoopProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 900, intensity: 0.55, delayMs: 0 };

const pulseTemplate: MotionTemplate = {
  id: 'pulse',
  label: 'Pulse',
  category: 'loop',
  description: 'Breathes opacity forever.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 240, max: 4000, step: 20, unit: 'ms', defaultValue: 900 },
    { key: 'intensity', label: 'Intensity', kind: 'number', min: 0.1, max: 1, step: 0.05, unit: '', defaultValue: 0.55 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 20, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    if (elapsedMs < delayMs) return { transform: baseTransform, opacity: baseOpacity };
    const progress = normalizeLoopProgress(elapsedMs - delayMs, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const pulseOpacity = clamp(baseOpacity - readConfigNumber(config, 'intensity', defaults.intensity) * 0.45, 0.15, baseOpacity);
    const mix = progress <= 0.5
      ? applyEasing(progress / 0.5, 'ease-in-out')
      : applyEasing((1 - progress) / 0.5, 'ease-in-out');
    return {
      transform: baseTransform,
      opacity: pulseOpacity + (baseOpacity - pulseOpacity) * mix,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity, baseTransform) => {
    const pulseOpacity = clamp(baseOpacity - readConfigNumber(config, 'intensity', defaults.intensity) * 0.45, 0.15, baseOpacity);
    return [
      { transform: baseTransform, opacity: baseOpacity, offset: 0 },
      { transform: baseTransform, opacity: pulseOpacity, offset: 0.5 },
      { transform: baseTransform, opacity: baseOpacity, offset: 1 },
    ];
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-in-out',
    iterations: Number.POSITIVE_INFINITY,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Pulse' }),
};

export default pulseTemplate;
