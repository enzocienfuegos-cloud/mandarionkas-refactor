import { getWidgetDefinition } from '../widgets/registry/widget-registry';

export type TimelineWidgetType = Parameters<typeof getWidgetDefinition>[0];

export type TimelineKeyframe = {
  id: string;
  atMs: number;
  property: string;
  value: number;
  easing?: string;
};

export type TimelineWidget = {
  id: string;
  name: string;
  type: TimelineWidgetType;
  hidden?: boolean;
  locked?: boolean;
  parentId?: string;
  childIds?: string[];
  zIndex: number;
  timeline: {
    startMs: number;
    endMs: number;
    keyframes?: TimelineKeyframe[];
  };
};

export type TimelineDisplayRow = {
  widget: TimelineWidget;
  timing: { startMs: number; endMs: number };
  keyframes: TimelineKeyframe[];
  depth: number;
  parentGroupId?: string;
  ancestorIds: string[];
  isGroup: boolean;
  childCount: number;
  isCollapsed: boolean;
};

export type TimelineDragState =
  | { mode: 'playhead'; originX: number; startMs: number }
  | {
      mode: 'move-bar';
      widgetId: string;
      originX: number;
      startStartMs: number;
      startEndMs: number;
      draftStartMs: number;
      draftEndMs: number;
      snapTargetMs?: number;
      snapLabel?: string;
    }
  | {
      mode: 'trim-start';
      widgetId: string;
      originX: number;
      startStartMs: number;
      startEndMs: number;
      draftStartMs: number;
      draftEndMs: number;
      snapTargetMs?: number;
      snapLabel?: string;
    }
  | {
      mode: 'trim-end';
      widgetId: string;
      originX: number;
      startStartMs: number;
      startEndMs: number;
      draftStartMs: number;
      draftEndMs: number;
      snapTargetMs?: number;
      snapLabel?: string;
    }
  | {
      mode: 'move-keyframe';
      widgetId: string;
      keyframeId: string;
      originX: number;
      startAtMs: number;
      draftAtMs: number;
      snapTargetMs?: number;
      snapLabel?: string;
    }
  | null;
