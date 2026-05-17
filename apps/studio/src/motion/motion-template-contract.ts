import type { JSX } from 'react';
import type { WidgetNode, WidgetType } from '../domain/document/types';
import type { WidgetCapabilities } from '../widgets/registry/widget-definition';
import type { AnimationSpec } from './animation-engine/plan';

export type MotionCategory = 'entrance' | 'idle' | 'exit' | 'hover';
export type MotionConfig = Record<string, number | string>;

export type CompositorMotionKeyframe = {
  transform?: string;
  opacity?: number;
  offset?: number;
};

export type CompositorMotionOptions = {
  duration: number;
  delay?: number;
  easing?: string;
  iterations?: number | 'infinite';
  fill?: FillMode;
};

export type CompositorMotionSpec = {
  keyframes: CompositorMotionKeyframe[];
  options: CompositorMotionOptions;
  willChange?: string;
};

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

export type MotionTemplate = {
  id: string;
  label: string;
  category: MotionCategory;
  description: string;
  fields: MotionConfigField[];
  defaults: MotionConfig;
  buildSpec?: (config: MotionConfig, widget: WidgetNode) => AnimationSpec;
  buildCompositorMotion: (config: MotionConfig) => CompositorMotionSpec;
  isLoop: boolean;
  thumbnail: (config?: MotionConfig) => JSX.Element;
  supportsWidgetType?: (type: WidgetType, capabilities: WidgetCapabilities | undefined) => boolean;
};

export type MotionSelection = {
  template: MotionTemplate;
  config: MotionConfig;
};
