import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 3000, distancePx: 8, delayMs: 0 };

const floatTemplate: MotionTemplate = {
  id: 'float',
  label: 'Float',
  category: 'loop',
  description: 'Continuous levitation.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 800, max: 8000, step: 100, unit: 'ms', defaultValue: 3000 },
    { key: 'distancePx', label: 'Float distance', kind: 'number', min: 2, max: 40, step: 1, unit: 'px', defaultValue: 8 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 50, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  buildKeyframes: () => [],
  buildCompositorMotion: (config) => {
    const durationMs = Math.max(800, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    const delayMs = Math.max(0, readConfigNumber(config, 'delayMs', defaults.delayMs));
    return {
      keyframes: [
        { transform: 'translate3d(0, 0, 0)', offset: 0 },
        { transform: `translate3d(0, -${distancePx}px, 0)`, offset: 0.25 },
        { transform: 'translate3d(0, 0, 0)', offset: 0.5 },
        { transform: `translate3d(0, ${distancePx}px, 0)`, offset: 0.75 },
        { transform: 'translate3d(0, 0, 0)', offset: 1 },
      ],
      options: {
        duration: durationMs,
        delay: delayMs,
        easing: 'cubic-bezier(0.45, 0, 0.55, 1)',
        iterations: 'infinite',
        fill: 'both',
      },
      willChange: 'transform',
    };
  },
  thumbnail: () => createElement(MotionThumbnail, { label: 'Float' }),
};

export default floatTemplate;
