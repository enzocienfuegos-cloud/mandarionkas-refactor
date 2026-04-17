import { useMemo } from 'react';
import { replaceStudioState, studioStore } from '../core/store/studio-store';
import type {
  ActionNode,
  ApprovalStatus,
  BindingSource,
  CollaborationAnchor,
  CommentStatus,
  FeedRecord,
  KeyframeEasing,
  KeyframeProperty,
  RuleOperator,
  VariantName,
  WidgetBinding,
  WidgetNode,
} from '../domain/document/types';

function dispatch(command: any): void {
  studioStore.dispatch(command as never);
}

export function useDocumentActions() {
  return useMemo(() => ({
    updateName: (name: string) => dispatch({ type: 'UPDATE_DOCUMENT_NAME', name }),
    applyCanvasPreset: (presetId: string) => dispatch({ type: 'APPLY_CANVAS_PRESET', presetId }),
    updateCanvasSize: (width: number, height: number) => dispatch({ type: 'UPDATE_CANVAS_SIZE', width, height }),
    updateCanvasBackground: (backgroundColor: string) => dispatch({ type: 'UPDATE_CANVAS_BACKGROUND', backgroundColor }),
    updatePlatformMetadata: (patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_DOCUMENT_PLATFORM_METADATA', patch }),
    updateReleaseSettings: (patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_RELEASE_SETTINGS', patch }),
    setShareLink: (shareLink: string) => dispatch({ type: 'SET_SHARE_LINK', shareLink }),
    markAutosaved: (at: string) => dispatch({ type: 'MARK_DOCUMENT_AUTOSAVED', at }),
  }), []);
}

export function useSceneActions() {
  return useMemo(() => ({
    selectScene: (sceneId: string) => dispatch({ type: 'SELECT_SCENE', sceneId }),
    previousScene: () => dispatch({ type: 'GO_TO_PREVIOUS_SCENE' }),
    nextScene: () => dispatch({ type: 'GO_TO_NEXT_SCENE' }),
    addScene: () => dispatch({ type: 'ADD_SCENE' }),
    duplicateScene: (sceneId: string) => dispatch({ type: 'DUPLICATE_SCENE', sceneId }),
    deleteScene: (sceneId: string) => dispatch({ type: 'DELETE_SCENE', sceneId }),
    updateScene: (sceneId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_SCENE', sceneId, patch }),
  }), []);
}

export function useWidgetActions() {
  return useMemo(() => ({
    createWidget: (widgetType: WidgetNode['type'], placement?: { x: number; y: number; anchor?: 'center' | 'top-left' }, initial?: { props?: Record<string, unknown>; style?: Record<string, unknown> }) => dispatch({ type: 'CREATE_WIDGET', widgetType, placement, initialProps: initial?.props, initialStyle: initial?.style }),
    selectWidget: (widgetId: string | null, additive = false) => dispatch({ type: 'SELECT_WIDGET', widgetId, additive }),
    selectWidgets: (widgetIds: string[], primaryWidgetId?: string) => dispatch({ type: 'SELECT_WIDGETS', widgetIds, primaryWidgetId }),
    updateWidgetName: (widgetId: string, name: string) => dispatch({ type: 'UPDATE_WIDGET_NAME', widgetId, name }),
    updateWidgetFrame: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_FRAME', widgetId, patch }),
    updateWidgetFrames: (patches: Array<{ widgetId: string; patch: Record<string, unknown> }>) => dispatch({ type: 'UPDATE_WIDGET_FRAMES', patches }),
    updateWidgetProps: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_PROPS', widgetId, patch }),
    updateWidgetStyle: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_STYLE', widgetId, patch }),
    updateWidgetTiming: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_TIMING', widgetId, patch }),
    updateWidgetBinding: (widgetId: string, key: string, binding?: WidgetBinding) => dispatch({ type: 'UPDATE_WIDGET_BINDING', widgetId, key, binding }),
    updateWidgetVariant: (widgetId: string, variant: VariantName, area: 'props' | 'style', patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_VARIANT', widgetId, variant, area, patch }),
    updateWidgetConditions: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_CONDITIONS', widgetId, patch }),
    toggleWidgetHidden: (widgetId: string) => dispatch({ type: 'TOGGLE_WIDGET_HIDDEN', widgetId }),
    toggleWidgetLocked: (widgetId: string) => dispatch({ type: 'TOGGLE_WIDGET_LOCKED', widgetId }),
    reorderWidget: (widgetId: string, direction: 'forward' | 'backward') => dispatch({ type: 'REORDER_WIDGET', widgetId, direction }),
    groupSelected: () => dispatch({ type: 'GROUP_SELECTED_WIDGETS' }),
    ungroupSelected: () => dispatch({ type: 'UNGROUP_SELECTED_WIDGETS' }),
    duplicateSelected: () => dispatch({ type: 'DUPLICATE_SELECTED_WIDGETS' }),
    deleteSelected: () => dispatch({ type: 'DELETE_SELECTED_WIDGETS' }),
    setActiveWidget: (widgetId?: string) => dispatch({ type: 'SET_ACTIVE_WIDGET', widgetId }),
    executeAction: (actionId: string) => dispatch({ type: 'EXECUTE_ACTION', actionId }),
    setHoveredWidget: (widgetId?: string) => dispatch({ type: 'SET_HOVERED_WIDGET', widgetId }),
  }), []);
}

export function useWidgetBehaviorActions() {
  return useMemo(() => ({
    addWidgetAction: (widgetId: string) => dispatch({ type: 'ADD_WIDGET_ACTION', widgetId }),
    updateWidgetAction: (actionId: string, patch: Partial<ActionNode>) => dispatch({ type: 'UPDATE_WIDGET_ACTION', actionId, patch }),
    removeWidgetAction: (actionId: string) => dispatch({ type: 'REMOVE_WIDGET_ACTION', actionId }),
    executeAction: (actionId: string) => dispatch({ type: 'EXECUTE_ACTION', actionId }),
  }), []);
}

export function useTimelineActions() {
  return useMemo(() => ({
    setPlayhead: (playheadMs: number) => dispatch({ type: 'SET_PLAYHEAD', playheadMs }),
    setPlaying: (isPlaying: boolean) => dispatch({ type: 'SET_PLAYING', isPlaying }),
    addKeyframe: (widgetId: string, property: KeyframeProperty, atMs?: number) => dispatch({ type: 'ADD_KEYFRAME', widgetId, property, atMs }),
    updateKeyframe: (widgetId: string, keyframeId: string, patch: { atMs?: number; value?: number; easing?: KeyframeEasing }) => dispatch({ type: 'UPDATE_KEYFRAME', widgetId, keyframeId, patch }),
    removeKeyframe: (widgetId: string, keyframeId: string) => dispatch({ type: 'REMOVE_KEYFRAME', widgetId, keyframeId }),
  }), []);
}

export function useUiActions() {
  return useMemo(() => ({
    setPreviewMode: (previewMode: boolean) => dispatch({ type: 'SET_PREVIEW_MODE', previewMode }),
    setPlaying: (isPlaying: boolean) => dispatch({ type: 'SET_PLAYING', isPlaying }),
    setZoom: (zoom: number) => dispatch({ type: 'SET_ZOOM', zoom }),
    setActiveVariant: (variant: VariantName) => dispatch({ type: 'SET_ACTIVE_VARIANT', variant }),
    setActiveFeedSource: (source: BindingSource) => dispatch({ type: 'SET_ACTIVE_FEED_SOURCE', source }),
    setActiveFeedRecord: (recordId: string) => dispatch({ type: 'SET_ACTIVE_FEED_RECORD', recordId }),
    setLeftTab: (tab: import('../domain/document/types').StudioState['ui']['activeLeftTab']) => dispatch({ type: 'SET_LEFT_TAB', tab }),
    setStageBackdrop: (stageBackdrop: import('../domain/document/types').StudioState['ui']['stageBackdrop']) => dispatch({ type: 'SET_STAGE_BACKDROP', stageBackdrop }),
    setStageRulers: (enabled: boolean) => dispatch({ type: 'SET_STAGE_RULERS', enabled }),
    setWidgetBadgesVisibility: (enabled: boolean) => dispatch({ type: 'SET_WIDGET_BADGES_VISIBILITY', enabled }),
    undo: () => dispatch({ type: 'UNDO' }),
    redo: () => dispatch({ type: 'REDO' }),
  }), []);
}

export function useFeedActions() {
  return useMemo(() => ({
    upsertFeedRecord: (source: BindingSource, record: FeedRecord) => dispatch({ type: 'UPSERT_FEED_RECORD', source, record }),
    deleteFeedRecord: (source: BindingSource, recordId: string) => dispatch({ type: 'DELETE_FEED_RECORD', source, recordId }),
  }), []);
}

export function useCollaborationActions() {
  return useMemo(() => ({
    addComment: (anchor: CollaborationAnchor, message: string, author: string) => dispatch({ type: 'ADD_COMMENT', anchor, message, author }),
    updateCommentStatus: (commentId: string, status: CommentStatus) => dispatch({ type: 'UPDATE_COMMENT_STATUS', commentId, status }),
    deleteComment: (commentId: string) => dispatch({ type: 'DELETE_COMMENT', commentId }),
    addApprovalRequest: (label: string, requestedBy: string) => dispatch({ type: 'ADD_APPROVAL_REQUEST', label, requestedBy }),
    updateApprovalStatus: (approvalId: string, status: ApprovalStatus, reviewer: string, note?: string) => dispatch({ type: 'UPDATE_APPROVAL_STATUS', approvalId, status, reviewer, note }),
  }), []);
}

export function useStudioSessionActions() {
  return useMemo(() => ({
    replaceState: (nextState: import('../domain/document/types').StudioState) => replaceStudioState(nextState),
  }), []);
}
