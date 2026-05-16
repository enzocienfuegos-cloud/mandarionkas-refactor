import { createElement } from 'react';
import { normalizeLoopProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 900, intensity: 0.55, delayMs: 0 };

const pulseTemplate: MotionTemplate = {
  id: 'pulse',
  label: 'Pulse',
  category: 'loop',
  description: 'Continuous opacity pulse.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 300, max: 4000, step: 50, unit: 'ms', defaultValue: 900 },
    { key: 'intensity', label: 'Intensity', kind: 'number', min: 0.1, max: 1, step: 0.05, unit: '', defaultValue: 0.55 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 50, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => {
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    if (elapsedMs < delayMs) {
      return { transform: '', opacity: baseOpacity };
    }
    const progress = normalizeLoopProgress(
      elapsedMs - delayMs,
      readConfigNumber(config, 'durationMs', defaults.durationMs),
    );
    const intensity = readConfigNumber(config, 'intensity', defaults.intensity);
    const pulseOpacity = Math.max(0.15, baseOpacity - intensity * 0.45);
    const mix = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
    return {
      transform: '',
      opacity: pulseOpacity + (baseOpacity - pulseOpacity) * mix,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const intensity = readConfigNumber(config, 'intensity', defaults.intensity);
    const pulseOpacity = Math.max(0.15, baseOpacity - intensity * 0.45);
    return [
      { opacity: baseOpacity, offset: 0 },
      { opacity: pulseOpacity, offset: 0.5 },
      { opacity: baseOpacity, offset: 1 },
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
