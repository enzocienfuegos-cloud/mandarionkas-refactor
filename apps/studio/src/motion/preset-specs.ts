import { applyEasing, normalizeLoopProgress, normalizeOneShotProgress, readConfigNumber } from './motion-engine';
import type { MotionConfig, MotionFrameState } from './motion-template-contract';

export type MotionPresetSpec =
  | {
      mode: 'fade-in';
      easing: 'ease-out';
    }
  | {
      mode: 'fade-out';
      easing: 'ease-in';
    }
  | {
      mode: 'translate-in';
      axis: 'x' | 'y';
      sign: -1 | 1;
      easing: 'ease-out';
      fade: boolean;
    }
  | {
      mode: 'pulse';
    }
  | {
      mode: 'float';
      axis: 'y';
    };

export const MOTION_PRESET_SPECS: Record<string, MotionPresetSpec> = {
  appear: { mode: 'fade-in', easing: 'ease-out' },
  'fade-in': { mode: 'fade-in', easing: 'ease-out' },
  'fade-out': { mode: 'fade-out', easing: 'ease-in' },
  'fade-up': { mode: 'translate-in', axis: 'y', sign: 1, easing: 'ease-out', fade: true },
  float: { mode: 'float', axis: 'y' },
  pulse: { mode: 'pulse' },
  'slide-in-left': { mode: 'translate-in', axis: 'x', sign: -1, easing: 'ease-out', fade: false },
  'slide-in-right': { mode: 'translate-in', axis: 'x', sign: 1, easing: 'ease-out', fade: false },
  'slide-in-up': { mode: 'translate-in', axis: 'y', sign: 1, easing: 'ease-out', fade: false },
  'slide-in-down': { mode: 'translate-in', axis: 'y', sign: -1, easing: 'ease-out', fade: false },
};

export function computeMotionStateFromSpec(
  spec: MotionPresetSpec,
  config: MotionConfig,
  elapsedMs: number,
  baseOpacity: number,
): MotionFrameState {
  switch (spec.mode) {
    case 'fade-in': {
      const progress = normalizeOneShotProgress(
        elapsedMs,
        readConfigNumber(config, 'delayMs', 0),
        readConfigNumber(config, 'durationMs', 700),
      );
      return {
        transform: '',
        opacity: baseOpacity * applyEasing(progress, spec.easing),
      };
    }
    case 'fade-out': {
      const progress = normalizeOneShotProgress(
        elapsedMs,
        0,
        readConfigNumber(config, 'durationMs', 700),
      );
      return {
        transform: '',
        opacity: baseOpacity * (1 - applyEasing(progress, spec.easing)),
      };
    }
    case 'translate-in': {
      const distancePx = readConfigNumber(config, 'distancePx', 24);
      const progress = normalizeOneShotProgress(
        elapsedMs,
        readConfigNumber(config, 'delayMs', 0),
        readConfigNumber(config, 'durationMs', 700),
      );
      const eased = applyEasing(progress, spec.easing);
      const translateAmount = (spec.sign * distancePx * (1 - eased)).toFixed(2);
      return {
        transform: spec.axis === 'x'
          ? `translateX(${translateAmount}px)`
          : `translateY(${translateAmount}px)`,
        opacity: spec.fade ? baseOpacity * eased : baseOpacity,
      };
    }
    case 'pulse': {
      const delayMs = readConfigNumber(config, 'delayMs', 0);
      if (elapsedMs < delayMs) {
        return { transform: '', opacity: baseOpacity };
      }
      const progress = normalizeLoopProgress(
        elapsedMs - delayMs,
        readConfigNumber(config, 'durationMs', 900),
      );
      const intensity = readConfigNumber(config, 'intensity', 0.55);
      const pulseOpacity = Math.max(0.15, baseOpacity - intensity * 0.45);
      const mix = progress <= 0.5 ? progress * 2 : (1 - progress) * 2;
      return {
        transform: '',
        opacity: pulseOpacity + (baseOpacity - pulseOpacity) * mix,
      };
    }
    case 'float': {
      const delayMs = readConfigNumber(config, 'delayMs', 0);
      if (elapsedMs < delayMs) {
        return { transform: '', opacity: baseOpacity };
      }
      const progress = normalizeLoopProgress(
        elapsedMs - delayMs,
        readConfigNumber(config, 'durationMs', 3000),
      );
      const wave = Math.sin(progress * 2 * Math.PI);
      const distancePx = readConfigNumber(config, 'distancePx', 8);
      return {
        transform: `translateY(${(wave * distancePx).toFixed(2)}px)`,
        opacity: baseOpacity,
      };
    }
    default:
      return { transform: '', opacity: baseOpacity };
  }
}
