import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { computeMotionStateFromSpec, MOTION_PRESET_SPECS } from '../preset-specs';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700 };

const fadeOutTemplate: MotionTemplate = {
  id: 'fade-out',
  label: 'Fade out',
  category: 'exit',
  description: 'Fade out at the end of the scene.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity) => computeMotionStateFromSpec(MOTION_PRESET_SPECS['fade-out'], config, elapsedMs, baseOpacity),
  buildWAAPIKeyframes: (_config, baseOpacity) => [
    { opacity: baseOpacity, offset: 0 },
    { opacity: 0, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-in',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade out' }),
};

export default fadeOutTemplate;
