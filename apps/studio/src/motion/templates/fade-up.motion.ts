import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';
import { buildTranslateInKeyframes } from './shared';

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
  buildKeyframes: (config, widgetFrame, widgetTimeline) => buildTranslateInKeyframes(
    'fade-up',
    'y',
    widgetFrame,
    widgetTimeline,
    readConfigNumber(config, 'durationMs', defaults.durationMs),
    readConfigNumber(config, 'delayMs', defaults.delayMs),
    readConfigNumber(config, 'distancePx', defaults.distancePx),
    1,
    true,
  ),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Fade up' }),
};

export default fadeUpTemplate;
