import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
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
  buildSpec: (config) => ({
    from: { y: readConfigNumber(config, 'distancePx', defaults.distancePx), opacity: 0 },
    to: { y: 0, opacity: 1 },
    ease: 'expo.out',
    willChange: 'transform, opacity',
  }),
  buildCompositorMotion: (config) => {
    const durationMs = readConfigNumber(config, 'durationMs', defaults.durationMs);
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    return {
      keyframes: [
        { opacity: 0, transform: `translate3d(0, ${distancePx}px, 0)`, offset: 0 },
        { opacity: 1, transform: 'translate3d(0, 0, 0)', offset: 1 },
      ],
      options: { duration: durationMs, delay: delayMs, easing: 'ease-out', iterations: 1, fill: 'both' },
      willChange: 'opacity, transform',
    };
  },
  isLoop: false,
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade up' }),
};

export default fadeUpTemplate;
