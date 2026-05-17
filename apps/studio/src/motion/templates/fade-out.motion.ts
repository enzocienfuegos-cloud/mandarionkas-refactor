import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';
import { buildFadeOutKeyframes } from './shared';

const defaults = { durationMs: 700 };

const fadeOutTemplate: MotionTemplate = {
  id: 'fade-out',
  label: 'Fade out',
  category: 'exit',
  description: 'Fade out at the end of the scene.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
  ],
  defaults,
  buildKeyframes: (config, _widgetFrame, widgetTimeline) => buildFadeOutKeyframes(
    'fade-out',
    widgetTimeline,
    readConfigNumber(config, 'durationMs', defaults.durationMs),
  ),
  buildCompositorMotion: (config) => {
    const durationMs = readConfigNumber(config, 'durationMs', defaults.durationMs);
    return {
      keyframes: [
        { opacity: 1, offset: 0 },
        { opacity: 0, offset: 1 },
      ],
      options: { duration: durationMs, easing: 'ease-in', iterations: 1, fill: 'both' },
      willChange: 'opacity',
    };
  },
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade out' }),
};

export default fadeOutTemplate;
