import { createElement } from 'react';
import { readConfigNumber } from '../motion-engine';
import type { MotionTemplate } from '../motion-template-contract';
import { MotionThumbnail } from '../react/MotionThumbnail';

const defaults = { durationMs: 900, intensity: 0.55, delayMs: 0 };

const pulseTemplate: MotionTemplate = {
  id: 'pulse',
  label: 'Pulse',
  category: 'idle',
  description: 'Continuous opacity pulse.',
  fields: [
    { key: 'durationMs', label: 'Cycle duration', kind: 'number', min: 300, max: 4000, step: 50, unit: 'ms', defaultValue: 900 },
    { key: 'intensity', label: 'Intensity', kind: 'number', min: 0.1, max: 1, step: 0.05, unit: '', defaultValue: 0.55 },
    { key: 'delayMs', label: 'Start delay', kind: 'number', min: 0, max: 3000, step: 50, unit: 'ms', defaultValue: 0 },
  ],
  defaults,
  buildSpec: (config) => {
    const intensity = readConfigNumber(config, 'intensity', defaults.intensity);
    const lowOpacity = Math.max(0.15, 1 - intensity * 0.45);
    return {
      from: { opacity: 1 },
      to: { opacity: lowOpacity },
      ease: 'sine.inOut',
      willChange: 'opacity',
    };
  },
  buildCompositorMotion: (config) => {
    const durationMs = Math.max(300, readConfigNumber(config, 'durationMs', defaults.durationMs));
    const delayMs = Math.max(0, readConfigNumber(config, 'delayMs', defaults.delayMs));
    const intensity = readConfigNumber(config, 'intensity', defaults.intensity);
    const lowOpacity = Math.max(0.15, 1 - intensity * 0.45);
    return {
      keyframes: [
        { opacity: 1, offset: 0 },
        { opacity: lowOpacity, offset: 0.5 },
        { opacity: 1, offset: 1 },
      ],
      options: { duration: durationMs, delay: delayMs, easing: 'ease-in-out', iterations: 'infinite', fill: 'both' },
      willChange: 'opacity',
    };
  },
  isLoop: true,
  thumbnail: () => createElement(MotionThumbnail, { label: 'Pulse' }),
};

export default pulseTemplate;
