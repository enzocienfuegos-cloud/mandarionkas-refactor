import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { computeMotionStateFromSpec, MOTION_PRESET_SPECS } from '../preset-specs';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 80 };

const slideInUpTemplate: MotionTemplate = {
  id: 'slide-in-up',
  label: 'Slide in from below',
  category: 'entrance',
  description: 'Slide in upward from below.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 400, step: 4, unit: 'px', defaultValue: 80 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => computeMotionStateFromSpec(MOTION_PRESET_SPECS['slide-in-up'], config, elapsedMs, baseOpacity),
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return [
      { transform: `translateY(${distancePx}px)`, opacity: baseOpacity, offset: 0 },
      { transform: 'translateY(0px)', opacity: baseOpacity, offset: 1 },
    ];
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Slide ↑' }),
};

export default slideInUpTemplate;
