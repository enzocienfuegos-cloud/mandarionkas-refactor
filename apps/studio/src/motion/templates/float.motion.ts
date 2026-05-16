import { createElement } from 'react';
import { normalizeLoopProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 3000, distancePx: 8, delayMs: 0 };

const floatTemplate: MotionTemplate = {
  id: 'float',
  label: 'Float',
  category: 'loop',
  description: 'Continuous levitation.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 800, max: 8000, step: 100, unit: 'ms', defaultValue: 3000 },
    { key: 'distancePx', label: 'Float distance', kind: 'number', min: 2, max: 40, step: 1, unit: 'px', defaultValue: 8 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 50, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => {
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    if (elapsedMs < delayMs) return { transform: '', opacity: baseOpacity };
    const progress = normalizeLoopProgress(
      elapsedMs - delayMs,
      readConfigNumber(config, 'durationMs', defaults.durationMs),
    );
    const wave = Math.sin(progress * 2 * Math.PI);
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return {
      transform: `translateY(${(wave * distancePx).toFixed(2)}px)`,
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return Array.from({ length: 9 }, (_, index) => {
      const progress = index / 8;
      const wave = Math.sin(progress * 2 * Math.PI);
      return {
        transform: `translateY(${(wave * distancePx).toFixed(2)}px)`,
        opacity: baseOpacity,
        offset: progress,
      };
    });
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'linear',
    iterations: Number.POSITIVE_INFINITY,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Float' }),
};

export default floatTemplate;
