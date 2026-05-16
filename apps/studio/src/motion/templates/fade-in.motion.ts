import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';
import { buildFadeInKeyframes } from './shared';

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
  buildKeyframes: (config, _widgetFrame, widgetTimeline) => buildFadeInKeyframes(
    'fade-in',
    widgetTimeline,
    readConfigNumber(config, 'durationMs', defaults.durationMs),
    readConfigNumber(config, 'delayMs', defaults.delayMs),
  ),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade in' }),
};

export default fadeInTemplate;
