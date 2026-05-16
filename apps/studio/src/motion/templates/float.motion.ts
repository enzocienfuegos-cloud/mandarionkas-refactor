import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';
import { dedupeMotionKeyframes, motionKeyframe } from './shared';

const defaults = { durationMs: 3000, distancePx: 8, delayMs: 0 };

const floatTemplate: MotionTemplate = {
  id: 'float',
  label: 'Float',
  category: 'loop',
  description: 'Continuous levitation.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 800, max: 8000, step: 100, unit: 'ms', defaultValue: 3000 },
    { key: 'distancePx', label: 'Float distance', kind: 'number', min: 2, max: 40, step: 1, unit: 'px', defaultValue: 8 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 50, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  buildKeyframes: (config, widgetFrame, widgetTimeline) => {
    const durationMs = Math.max(800, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const distancePx = readConfigNumber(config, 'distancePx', defaults.distancePx);
    const delayMs = Math.max(0, readConfigNumber(config, 'delayMs', defaults.delayMs));
    const startMs = widgetTimeline.startMs + delayMs;
    const baseY = widgetFrame.y;
    const keyframes = [];
    for (let cycleStartMs = startMs; cycleStartMs <= widgetTimeline.endMs; cycleStartMs += durationMs) {
      for (let step = 0; step <= 8; step += 1) {
        const progress = step / 8;
        const atMs = Math.min(widgetTimeline.endMs, cycleStartMs + durationMs * progress);
        const wave = Math.sin(progress * 2 * Math.PI);
        keyframes.push(
          motionKeyframe(
            `float:y:${cycleStartMs}:${step}`,
            'y',
            atMs,
            baseY + wave * distancePx,
            'linear',
          ),
        );
      }
    }
    return dedupeMotionKeyframes(keyframes);
  },
  thumbnail: () => createElement(MotionThumbnail, { label: 'Float' }),
};

export default floatTemplate;
