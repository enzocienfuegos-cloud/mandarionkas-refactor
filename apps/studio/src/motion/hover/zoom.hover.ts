import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 240, scale: 1.05 };

const zoomHoverTemplate: MotionTemplate = {
  id: 'zoom',
  label: 'Zoom',
  category: 'hover',
  description: 'Scales the element up on hover.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 1000, step: 20, unit: 'ms', defaultValue: 240 },
    { key: 'scale', label: 'Scale', kind: 'number', min: 1.01, max: 1.5, step: 0.01, unit: 'x', defaultValue: 1.05 },
  ],
  defaults,
  computeState: (config, _elapsedMs, baseOpacity) => {
    const scale = readConfigNumber(config, 'scale', defaults.scale);
    return {
      transform: `scale(${scale})`,
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity) => {
    const scale = readConfigNumber(config, 'scale', defaults.scale);
    return [
      { transform: 'scale(1)', opacity: baseOpacity, offset: 0 },
      { transform: `scale(${scale})`, opacity: baseOpacity, offset: 1 },
    ];
  },
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Zoom' }),
};

export default zoomHoverTemplate;
