import { getLiveWidgetFrame, getLiveWidgetOpacity } from '../../../domain/document/timeline';
import type { WidgetFrame, WidgetNode } from '../../../domain/document/types';

type WidgetsById = Record<string, WidgetNode>;
type LiveFrameById = Record<string, WidgetFrame>;

export function resolveInheritedMotionFrame(args: {
  widget: WidgetNode;
  widgetsById: WidgetsById;
  liveFrameById: LiveFrameById;
  playheadMs: number;
  getLiveFrame: typeof getLiveWidgetFrame;
  ownFrame: WidgetFrame;
}): WidgetFrame {
  const { widget, widgetsById, liveFrameById, playheadMs, getLiveFrame, ownFrame } = args;
  let nextX = ownFrame.x;
  let nextY = ownFrame.y;
  const visited = new Set<string>([widget.id]);
  let currentParentId = widget.parentId;

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parent = widgetsById[currentParentId];
    if (!parent) break;
    const parentLiveFrame = liveFrameById[parent.id] ?? getLiveFrame(parent, playheadMs);
    nextX += parentLiveFrame.x - parent.frame.x;
    nextY += parentLiveFrame.y - parent.frame.y;
    currentParentId = parent.parentId;
  }

  return {
    ...ownFrame,
    x: nextX,
    y: nextY,
  };
}

export function resolveInheritedOpacity(args: {
  widget: WidgetNode;
  widgetsById: WidgetsById;
  playheadMs: number;
  ownOpacity: number;
}): number {
  const { widget, widgetsById, playheadMs, ownOpacity } = args;
  let nextOpacity = ownOpacity;
  const visited = new Set<string>([widget.id]);
  let currentParentId = widget.parentId;

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parent = widgetsById[currentParentId];
    if (!parent) break;
    nextOpacity *= getLiveWidgetOpacity(parent, playheadMs);
    currentParentId = parent.parentId;
  }

  return Math.max(0, Math.min(1, nextOpacity));
}

export function isVisibleWithinParentTimeline(args: {
  widget: WidgetNode;
  widgetsById: WidgetsById;
  isWidgetVisible: (widgetId: string) => boolean;
}): boolean {
  const { widget, widgetsById, isWidgetVisible } = args;
  let currentParentId = widget.parentId;
  const visited = new Set<string>([widget.id]);

  while (currentParentId) {
    if (visited.has(currentParentId)) break;
    visited.add(currentParentId);
    const parent = widgetsById[currentParentId];
    if (!parent) return false;
    if (!isWidgetVisible(parent.id)) return false;
    currentParentId = parent.parentId;
  }

  return true;
}
