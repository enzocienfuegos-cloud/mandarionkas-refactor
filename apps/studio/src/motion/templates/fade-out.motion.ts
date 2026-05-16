import { createElement } from 'react';
import { applyEasing, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700 };

const fadeOutTemplate: MotionTemplate = {
  id: 'fade-out',
  label: 'Fade out',
  category: 'exit',
  description: 'Fades away at the end of the widget window.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const durationMs = readConfigNumber(config, 'durationMs', defaults.durationMs);
    const eased = applyEasing(Math.max(0, Math.min(1, elapsedMs / durationMs)), 'ease-in');
    return {
      transform: baseTransform,
      opacity: baseOpacity * (1 - eased),
    };
  },
  buildWAAPIKeyframes: (_config, baseOpacity, baseTransform) => [
    { transform: baseTransform, opacity: baseOpacity, offset: 0 },
    { transform: baseTransform, opacity: 0, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-in',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade out' }),
};

export default fadeOutTemplate;
