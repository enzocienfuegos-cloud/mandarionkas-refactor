import type { WidgetFrame } from '../../domain/document/types';

export type ResizeHandle = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
export type GuideLine = { x?: number; y?: number; kind: 'snap' | 'center' };
export type InteractionState = {
  widgetIds: string[];
  mode: 'drag' | 'resize';
  handle?: ResizeHandle;
  origin: { x: number; y: number };
  startFrames: Record<string, WidgetFrame>;
  liveFrames: Record<string, WidgetFrame>;
  guides: GuideLine[];
};
export type MarqueeState = { origin: { x: number; y: number }; current: { x: number; y: number } };
