import { createElement } from 'react';
import { applyEasing, mergeTransforms, normalizeOneShotProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 36 };

const slideInRightTemplate: MotionTemplate = {
  id: 'slide-in-right',
  label: 'Slide in right',
  category: 'entrance',
  description: 'Slides in from the right without fading.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 200, step: 2, unit: 'px', defaultValue: 36 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const progress = normalizeOneShotProgress(elapsedMs, readConfigNumber(config, 'delayMs', defaults.delayMs), readConfigNumber(config, 'durationMs', defaults.durationMs));
    const eased = applyEasing(progress, 'ease-out');
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return {
      transform: mergeTransforms(baseTransform, `translateX(${(distancePx * (1 - eased)).toFixed(2)}px)`),
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity, baseTransform) => [
    { transform: mergeTransforms(baseTransform, `translateX(${readConfigNumber(config, 'distancePx', defaults.distancePx)}px)`), opacity: baseOpacity, offset: 0 },
    { transform: baseTransform, opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Right' }),
};

export default slideInRightTemplate;
