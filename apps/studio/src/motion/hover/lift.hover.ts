import { createElement } from 'react';
import { mergeTransforms, normalizeOneShotProgress, readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 240, distancePx: 12, scale: 1.04 };

const liftHoverTemplate: MotionTemplate = {
  id: 'lift',
  label: 'Lift',
  category: 'hover',
  description: 'Subtle vertical lift on hover.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 3000, step: 20, unit: 'ms', defaultValue: 240 },
    { key: 'distancePx', label: 'Lift px', kind: 'number', min: 0, max: 80, step: 2, unit: 'px', defaultValue: 12 },
    { key: 'scale', label: 'Scale', kind: 'number', min: 1, max: 1.4, step: 0.01, unit: 'x', defaultValue: 1.04 },
  ],
  defaults,
  computeState: (config, elapsedMs, baseOpacity, baseTransform) => {
    const progress = normalizeOneShotProgress(elapsedMs, 0, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx) * progress;
    const scale = 1 + (readConfigNumber(config, 'scale', defaults.scale) - 1) * progress;
    return {
      transform: mergeTransforms(baseTransform, `translateY(-${distancePx.toFixed(2)}px) scale(${scale.toFixed(3)})`),
      opacity: baseOpacity,
    };
  },
  buildWAAPIKeyframes: (config, baseOpacity, baseTransform) => [
    { transform: baseTransform, opacity: baseOpacity, offset: 0 },
    {
      transform: mergeTransforms(
        baseTransform,
        `translateY(-${readConfigNumber(config, 'distancePx', defaults.distancePx)}px) scale(${readConfigNumber(config, 'scale', defaults.scale).toFixed(3)})`,
      ),
      opacity: baseOpacity,
      offset: 1,
    },
  ],
  buildWAAPIOptions: (config) => ({
    duration: readConfigNumber(config, 'durationMs', defaults.durationMs),
    easing: 'ease-out',
    iterations: 1,
    fill: 'both',
  }),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Lift' }),
};

export default liftHoverTemplate;
