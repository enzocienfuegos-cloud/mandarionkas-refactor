import { createElement } from 'react';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 240, distancePx: 12 };

const liftHoverTemplate: MotionTemplate = {
  id: 'lift',
  label: 'Lift',
  category: 'hover',
  description: 'Lifts the element upward on hover.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 1000, step: 20, unit: 'ms', defaultValue: 240 },
    { key: 'distancePx', label: 'Lift distance', kind: 'number', min: 1, max: 60, step: 1, unit: 'px', defaultValue: 12 },
  ],
  defaults,
  buildKeyframes: () => [],
  thumbnail: () => createElement(MotionThumbnail, { label: 'Lift' }),
};

export default liftHoverTemplate;
