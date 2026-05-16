import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { computeMotionStateFromSpec, MOTION_PRESET_SPECS } from '../preset-specs';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0 };

const fadeInTemplate: MotionTemplate = {
  id: 'fade-in',
  label: 'Fade in',
  category: 'entrance',
  description: 'Fade in at the start of the scene.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => computeMotionStateFromSpec(MOTION_PRESET_SPECS['fade-in'], config, elapsedMs, baseOpacity),
  buildWAAPIKeyframes: (_config, baseOpacity) => [
    { opacity: 0, offset: 0 },
    { opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade in' }),
};

export default fadeInTemplate;
