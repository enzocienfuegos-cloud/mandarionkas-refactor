import { createElement } from 'react';
import { applyEasing, normalizeOneShotProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 700, delayMs: 0 };

const appearTemplate: MotionTemplate = {
  id: 'appear',
  label: 'Appear',
  category: 'entrance',
  description: 'Fade in at the start of the scene.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const progress = normalizeOneShotProgress(
      elapsedMs,
      readConfigNumber(config, 'delayMs', defaults.delayMs),
      readConfigNumber(config, 'durationMs', defaults.durationMs),
    );
    return {
      transform: baseTransform,
      opacity: baseOpacity * applyEasing(progress, 'ease-out'),
    };
  },
  buildWAAPIKeyframes: (_config, baseOpacity, baseTransform) => [
    { transform: baseTransform, opacity: 0, offset: 0 },
    { transform: baseTransform, opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    delay: readConfigNumber(config, 'delayMs', defaults.delayMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Appear' }),
};

export default appearTemplate;
