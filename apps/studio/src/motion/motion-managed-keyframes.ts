import type { KeyframeNode } from '../domain/document/types';

export const MOTION_MANAGED_KEYFRAME_PREFIX = 'motion:';

export function isMotionManagedKeyframe(keyframe: KeyframeNode): boolean {
  return typeof keyframe.managedBy === 'string' && keyframe.managedBy.startsWith(MOTION_MANAGED_KEYFRAME_PREFIX);
}

export function stripMotionManagedKeyframes(keyframes: KeyframeNode[] = []): KeyframeNode[] {
  return keyframes
    .filter((item) => !isMotionManagedKeyframe(item))
    .sort((left, right) => left.atMs - right.atMs);
}

export function markMotionManagedKeyframes(
  keyframes: KeyframeNode[],
  templateId: string,
): KeyframeNode[] {
  const managedBy = `${MOTION_MANAGED_KEYFRAME_PREFIX}${templateId}`;
  return keyframes.map((keyframe) => ({
    ...keyframe,
    managedBy,
  }));
}
