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
    const cyclePoints = [
      { progress: 0, value: baseY },
      { progress: 0.25, value: baseY - distancePx },
      { progress: 0.5, value: baseY },
      { progress: 0.75, value: baseY + distancePx },
      { progress: 1, value: baseY },
    ];
    for (let cycleStartMs = startMs; cycleStartMs <= widgetTimeline.endMs; cycleStartMs += durationMs) {
      for (const point of cyclePoints) {
        const atMs = cycleStartMs + durationMs * point.progress;
        if (atMs > widgetTimeline.endMs) break;
        keyframes.push(
          motionKeyframe(
            `float:y:${cycleStartMs}:${point.progress}`,
            'y',
            atMs,
            point.value,
            'ease-in-out',
          ),
        );
      }
    }
    return dedupeMotionKeyframes(keyframes);
  },
  thumbnail: () => createElement(MotionThumbnail, { label: 'Float' }),
};

export default floatTemplate;
