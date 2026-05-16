import { createElement } from 'react';
import { clamp, normalizeLoopProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 800, scale: 1.05 };

const pulseHoverTemplate: MotionTemplate = {
  id: 'pulse',
  label: 'Pulse',
  category: 'hover',
  description: 'Pulses while the pointer stays over the widget.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 3000, step: 20, unit: 'ms', defaultValue: 800 },
    { key: 'scale', label: 'Scale', kind: 'number', min: 1, max: 1.3, step: 0.01, unit: 'x', defaultValue: 1.05 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const progress = normalizeLoopProgress(elapsedMs, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const wave = progress <= 0.5 ? progress / 0.5 : (1 - progress) / 0.5;
    const targetScale = readConfigNumber(config, 'scale', defaults.scale);
    const scale = 1 + (targetScale - 1) * clamp(wave, 0, 1);
    return {
      transform: `${baseTransform} scale(${scale.toFixed(3)})`.trim(),
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity, baseTransform) => [
    { transform: baseTransform, opacity: baseOpacity, offset: 0 },
    { transform: `${baseTransform} scale(${readConfigNumber(config, 'scale', defaults.scale).toFixed(3)})`.trim(), opacity: baseOpacity, offset: 0.5 },
    { transform: baseTransform, opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-in-out',
    iterations: Number.POSITIVE_INFINITY,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Hover pulse' }),
};

export default pulseHoverTemplate;
