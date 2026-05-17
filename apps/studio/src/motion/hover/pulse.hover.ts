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
  buildCompositorMotion: (config) => {
    const durationMs = Math.max(300, readConfigNumber(config, 'durationMs', defaults.durationMs));
    return {
      keyframes: [
        { opacity: 1, offset: 0 },
        { opacity: 0.7, offset: 0.5 },
        { opacity: 1, offset: 1 },
      ],
      options: {
        duration: durationMs,
        easing: 'ease-in-out',
        iterations: 'infinite',
        fill: 'both',
      },
      willChange: 'opacity',
    };
  },
  isLoop: true,
  thumbnail: () => createElement(MotionThumbnail, { label: 'Pulse' }),
};

export default pulseHoverTemplate;
