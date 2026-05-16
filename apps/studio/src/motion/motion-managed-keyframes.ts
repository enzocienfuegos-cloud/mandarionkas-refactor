import type { KeyframeNode } from '../domain/document/types';

export const MOTION_MANAGED_KEYFRAME_PROPERTIES: Array<KeyframeNode['property']> = ['opacity', 'y'];

export function stripMotionManagedKeyframes(keyframes: KeyframeNode[] = []): KeyframeNode[] {
  return keyframes
    .filter((item) => !MOTION_MANAGED_KEYFRAME_PROPERTIES.includes(item.property))
    .sort((left, right) => left.atMs - right.atMs);
}
