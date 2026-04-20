import type { ActionType, KeyframeProperty } from '../../domain/document/types';

export const KEYFRAME_PROPERTIES: KeyframeProperty[] = ['x', 'y', 'opacity'];
export const GENERIC_EXCLUDED_PROP_KEYS = new Set(['text', 'src', 'alt', 'shape', 'posterSrc', 'assetId']);
export const ACTION_TYPES: ActionType[] = [
  'open-url',
  'show-widget',
  'hide-widget',
  'toggle-widget',
  'set-text',
  'go-to-scene',
  'play-video',
  'pause-video',
  'seek-video',
  'mute-video',
  'unmute-video',
  'show-overlay',
  'hide-overlay',
  'fire-tracking-url',
  'emit-analytics-event',
];

export function toLabel(value: string): string {
  return value.replace(/([A-Z])/g, ' $1').replace(/[-_]/g, ' ').replace(/^./, (first) => first.toUpperCase());
}
