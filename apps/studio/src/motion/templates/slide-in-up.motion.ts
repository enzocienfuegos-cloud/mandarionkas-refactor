import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';
import { buildTranslateInKeyframes } from './shared';

const defaults = { durationMs: 700, delayMs: 0, distancePx: 80 };

const slideInUpTemplate: MotionTemplate = {
  id: 'slide-in-up',
  label: 'Slide in from below',
  category: 'entrance',
  description: 'Slide in upward from below.',
  fields: [
    { key: 'durationMs', label: 'Duration', kind: 'number', min: 120, max: 4000, step: 20, unit: 'ms', defaultValue: 700 },
    { key: 'delayMs', label: 'Delay', kind: 'number', min: 0, max: 6000, step: 20, unit: 'ms', defaultValue: 0 },
    { key: 'distancePx', label: 'Distance', kind: 'number', min: 0, max: 400, step: 4, unit: 'px', defaultValue: 80 },
  ],
  defaults,
  buildKeyframes: (config, widgetFrame, widgetTimeline) => buildTranslateInKeyframes(
    'slide-in-up',
    'y',
    widgetFrame,
    widgetTimeline,
    readConfigNumber(config, 'durationMs', defaults.durationMs),
    readConfigNumber(config, 'delayMs', defaults.delayMs),
    readConfigNumber(config, 'distancePx', defaults.distancePx),
    1,
    false,
  ),
  thumbnail: () => createElement(MotionThumbnail, { label: 'Slide ↑' }),
};

export default slideInUpTemplate;
