import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
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
  buildSpec: () => ({
    from: { opacity: 0 },
    to: { opacity: 1 },
    ease: 'expo.out',
    willChange: 'opacity',
  }),
  buildCompositorMotion: (config) => {
    const durationMs = readConfigNumber(config, 'durationMs', defaults.durationMs);
    const delayMs = readConfigNumber(config, 'delayMs', defaults.delayMs);
    return {
      keyframes: [
        { opacity: 0, offset: 0 },
        { opacity: 1, offset: 1 },
      ],
      options: { duration: durationMs, delay: delayMs, easing: 'ease-out', iterations: 1, fill: 'both' },
      willChange: 'opacity',
    };
  },
  isLoop: false,
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade in' }),
};

export default fadeInTemplate;
