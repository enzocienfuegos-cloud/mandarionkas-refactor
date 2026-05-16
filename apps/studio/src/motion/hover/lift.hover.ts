import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
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
  computeState: (config, _elapsedMs, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return {
      transform: `translateY(-${distancePx}px)`,
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return [
      { transform: 'translateY(0px)', opacity: baseOpacity, offset: 0 },
      { transform: `translateY(-${distancePx}px)`, opacity: baseOpacity, offset: 1 },
    ];
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Lift' }),
};

export default liftHoverTemplate;
