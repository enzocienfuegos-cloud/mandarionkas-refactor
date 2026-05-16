import type { JSX } from 'react';
import type { KeyframeNode, WidgetFrame, WidgetTimeline, WidgetType } from '../domain/document/types';
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

export type MotionTemplate = {
  id: string;
  label: string;
  category: MotionCategory;
  description?: string;
  fields: MotionConfigField[];
  defaults: MotionConfig;
  buildKeyframes: (
    config: MotionConfig,
    widgetFrame: WidgetFrame,
    widgetTimeline: WidgetTimeline,
  ) => KeyframeNode[];
  thumbnail: (config?: MotionConfig) => JSX.Element;
  supportsWidgetType?: (type: WidgetType, capabilities: WidgetCapabilities | undefined) => boolean;
};

export type MotionSelection = {
  template: MotionTemplate;
  config: MotionConfig;
};
