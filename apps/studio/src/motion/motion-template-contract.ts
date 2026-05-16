import type { JSX } from 'react';
import type { WidgetTimeline, WidgetType } from '../domain/document/types';
import type { WidgetCapabilities } from '../widgets/registry/widget-definition';

export type MotionCategory = 'entrance' | 'exit' | 'loop' | 'hover';
export type MotionConfig = Record<string, number | string>;

export type MotionConfigField =
  | {
      key: string;
      label: string;
      kind: 'number';
      min: number;
      max: number;
      step: number;
      unit?: 'ms' | 'px' | 'deg' | 'x' | '';
      defaultValue: number;
    }
  | {
      key: string;
      label: string;
      kind: 'select';
      options: Array<{ label: string; value: string }>;
      defaultValue: string;
    };

export type MotionFrameState = {
  /** Transform a aplicar AL TARGET INTERNO de MotionLayer.
   *  NO incluye rotation del widget (eso vive en el outer wrapper).
   *  Puede ser '' si el template no aplica transform (ej. appear, pulse). */
  transform: string;
  opacity: number;
};

export type MotionTemplate = {
  id: string;
  label: string;
  category: MotionCategory;
  description?: string;
  fields: MotionConfigField[];
  defaults: MotionConfig;
  computeState: (
    config: MotionConfig,
    elapsedMs: number,
    baseOpacity: number,
  ) => MotionFrameState;
  buildWAAPIKeyframes: (
    config: MotionConfig,
    baseOpacity: number,
  ) => Keyframe[];
  buildWAAPIOptions: (config: MotionConfig) => KeyframeAnimationOptions;
  thumbnail: (config?: MotionConfig) => JSX.Element;
  supportsWidgetType?: (type: WidgetType, capabilities: WidgetCapabilities | undefined) => boolean;
};

export type MotionSelection = {
  template: MotionTemplate;
  config: MotionConfig;
};

export type MotionPlaybackInput = {
  playheadMs: number;
  timeline: WidgetTimeline;
  config: MotionConfig;
  category: MotionCategory;
};
