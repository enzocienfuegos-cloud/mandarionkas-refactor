import { createElement } from 'react';
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
  buildKeyframes: () => [],
  thumbnail: () => createElement(MotionThumbnail, { label: 'Pulse' }),
};

export default pulseHoverTemplate;
