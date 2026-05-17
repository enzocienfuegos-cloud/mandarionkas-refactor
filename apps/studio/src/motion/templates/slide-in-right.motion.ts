import { createElement } from 'react';
import { resolveMotionIterations } from '../motion-iterations';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 80, iterations: 1 };

const slideInRightTemplate: MotionTemplate = {
  id: 'slide-in-right',
  label: 'Slide in from right',
  category: 'entrance',
  description: 'Slide in from the right edge.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 400, step: 4, unit: 'px', defaultValue: 80 },
    { key: 'iterations', label: 'Times', kind: 'number', min: 1, max: 10, step: 1, unit: '', defaultValue: 1 },
  ],
  defaults,
  buildSpec: (config) => ({
    from: { x: readConfigNumber(config, 'distancePx', defaults.distancePx) },
    to: { x: 0 },
    ease: 'expo.out',
    willChange: 'transform',
  }),
  buildCompositorMotion: (config) => {
    const durationMs = readConfigNumber(config, 'durationMs', defaults.durationMs);
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return {
      keyframes: [
        { transform: `translate3d(${distancePx}px, 0, 0)`, offset: 0 },
        { transform: 'translate3d(0, 0, 0)', offset: 1 },
      ],
      options: {
        duration: durationMs,
        delay: delayMs,
        easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        iterations: resolveMotionIterations(config, 1),
        fill: 'both',
      },
      willChange: 'transform',
    };
  },
  isLoop: false,
  thumbnail: () => createElement(MotionThumbnail, { label: 'Slide →' }),
};

export default slideInRightTemplate;
