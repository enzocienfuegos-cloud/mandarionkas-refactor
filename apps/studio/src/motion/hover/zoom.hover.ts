import { createElement } from 'react';
import { mergeTransforms, normalizeOneShotProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 240, scale: 1.06 };

const zoomHoverTemplate: MotionTemplate = {
  id: 'zoom',
  label: 'Zoom',
  category: 'hover',
  description: 'Scales the element on hover.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 3000, step: 20, unit: 'ms', defaultValue: 240 },
    { key: 'scale', label: 'Scale', kind: 'number', min: 1, max: 1.4, step: 0.01, unit: 'x', defaultValue: 1.06 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const progress = normalizeOneShotProgress(elapsedMs, 0, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const scale = 1 + (readConfigNumber(config, 'scale', defaults.scale) - 1) * progress;
    return {
      transform: mergeTransforms(baseTransform, `scale(${scale.toFixed(3)})`),
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity, baseTransform) => [
    { transform: baseTransform, opacity: baseOpacity, offset: 0 },
    { transform: mergeTransforms(baseTransform, `scale(${readConfigNumber(config, 'scale', defaults.scale).toFixed(3)})`), opacity: baseOpacity, offset: 1 },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Zoom' }),
};

export default zoomHoverTemplate;
