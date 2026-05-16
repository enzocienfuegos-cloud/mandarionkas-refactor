import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 600 };

const pulseHoverTemplate: MotionTemplate = {
  id: 'pulse',
  label: 'Pulse',
  category: 'hover',
  description: 'Pulses the opacity while hovered.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 300, max: 2000, step: 50, unit: 'ms', defaultValue: 600 },
  ],
  defaults,
  computeState: (_config, _elapsedMs, baseOpacity) => ({
    transform: '',
    opacity: baseOpacity * 0.7,
  }),
  buildWAAPIKeyframes: (_config, baseOpacity) => [
    { opacity: baseOpacity, offset: 0 },
    { opacity: baseOpacity * 0.7, offset: 0.5 },
    { opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-in-out',
    iterations: Number.POSITIVE_INFINITY,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Pulse' }),
};

export default pulseHoverTemplate;
