import { createElement } from 'react';
import { applyEasing, normalizeOneShotProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 80 };

const slideInRightTemplate: MotionTemplate = {
  id: 'slide-in-right',
  label: 'Slide in from right',
  category: 'entrance',
  description: 'Slide in from the right edge.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 400, step: 4, unit: 'px', defaultValue: 80 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    const progress = normalizeOneShotProgress(
      elapsedMs,
      readConfigNumber(config, 'delayMs', defaults.delayMs),
      readConfigNumber(config, 'durationMs', defaults.durationMs),
    );
    const eased = applyEasing(progress, 'ease-out');
    return {
      transform: `translateX(${(distancePx * (1 - eased)).toFixed(2)}px)`,
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return [
      { transform: `translateX(${distancePx}px)`, opacity: baseOpacity, offset: 0 },
      { transform: 'translateX(0px)', opacity: baseOpacity, offset: 1 },
    ];
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Slide →' }),
};

export default slideInRightTemplate;
