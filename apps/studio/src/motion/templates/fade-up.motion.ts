import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { computeMotionStateFromSpec, MOTION_PRESET_SPECS } from '../preset-specs';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 24 };

const fadeUpTemplate: MotionTemplate = {
  id: 'fade-up',
  label: 'Fade up',
  category: 'entrance',
  description: 'Fade in while sliding up from below.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 160, step: 2, unit: 'px', defaultValue: 24 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => computeMotionStateFromSpec(MOTION_PRESET_SPECS['fade-up'], config, elapsedMs, baseOpacity),
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return [
      { transform: `translateY(${distancePx}px)`, opacity: 0, offset: 0 },
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
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade up' }),
};

export default fadeUpTemplate;
