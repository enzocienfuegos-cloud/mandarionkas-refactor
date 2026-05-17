import type { KeyframeNode, WidgetMotion, WidgetNode } from '../domain/document/types';
import { stripMotionManagedKeyframes } from './motion-managed-keyframes';

function sortKeyframes(keyframes: KeyframeNode[]): KeyframeNode[] {
  return [...keyframes].sort((left, right) => left.atMs - right.atMs);
}

export function rebuildWidgetMotionKeyframes(
  widget: Pick<WidgetNode, 'frame' | 'style' | 'timeline'>,
  _motion: WidgetMotion | undefined,
  currentKeyframes: KeyframeNode[] = widget.timeline.keyframes ?? [],
): KeyframeNode[] {
  return sortKeyframes(stripMotionManagedKeyframes(currentKeyframes));
}
