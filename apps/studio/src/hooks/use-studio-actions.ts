import { useEffect, useMemo, useRef } from 'react';
import { buildResolvedWidgetsById } from '../domain/document/canvas-variants';
import { resolveNextSceneId } from '../domain/document/resolvers';
import { replaceStudioState, studioStore } from '../core/store/studio-store';
import { useStudioStoreRef } from '../core/store/use-studio-store';
import type { WidgetClipboardPayload, WidgetPropertyClipboardPayload } from '../core/commands/types';
import type {
  ActionNode,
  ApprovalStatus,
  BindingSource,
  CollaborationAnchor,
  CommentStatus,
  FeedRecord,
  KeyframeEasing,
  KeyframeNode,
  KeyframeProperty,
  RuleOperator,
  StudioPreferences,
  VariantName,
  WidgetBinding,
  WidgetNode,
} from '../domain/document/types';
import type { VariantContext, VariantRule } from '../domain/variants/types';
import { createEventClock } from '../motion/animation-engine/clock';
import { useOptionalAnimationEngine } from '../motion/animation-engine/react';
import { resolveSceneExitDurationMs } from '../motion/animation-engine/scene-exit';

function dispatch(command: any): void {
  studioStore.dispatch(command as never);
}

function nowMs(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();
}

function getSceneWidgets(state: import('../domain/document/types').StudioState, sceneId: string): WidgetNode[] {
  const resolvedWidgetsById = buildResolvedWidgetsById(state.document);
  const scene = state.document.scenes.find((item) => item.id === sceneId);
  if (!scene) return [];
  return scene.widgetIds
    .map((widgetId) => resolvedWidgetsById[widgetId])
    .filter((widget): widget is WidgetNode => Boolean(widget));
}

function resolvePreviousSceneId(state: import('../domain/document/types').StudioState): string | undefined {
  const scenes = [...state.document.scenes].sort((left, right) => left.order - right.order);
  const activeIndex = scenes.findIndex((scene) => scene.id === state.document.selection.activeSceneId);
  return activeIndex > 0 ? scenes[activeIndex - 1]?.id : undefined;
}

export function useDocumentActions() {
  return useMemo(() => ({
    updateName: (name: string) => dispatch({ type: 'UPDATE_DOCUMENT_NAME', name }),
    applyCanvasPreset: (presetId: string) => dispatch({ type: 'APPLY_CANVAS_PRESET', presetId }),
    addCanvasVariant: (presetId: string) => dispatch({ type: 'ADD_CANVAS_VARIANT', presetId }),
    selectCanvasVariant: (variantId: string) => dispatch({ type: 'SELECT_CANVAS_VARIANT', variantId }),
    renameCanvasVariant: (variantId: string, label: string) => dispatch({ type: 'RENAME_CANVAS_VARIANT', variantId, label }),
    duplicateCanvasVariant: (variantId: string) => dispatch({ type: 'DUPLICATE_CANVAS_VARIANT', variantId }),
    deleteCanvasVariant: (variantId: string) => dispatch({ type: 'DELETE_CANVAS_VARIANT', variantId }),
    setMasterCanvasVariant: (variantId: string) => dispatch({ type: 'SET_MASTER_CANVAS_VARIANT', variantId }),
    updateCanvasSize: (width: number, height: number) => dispatch({ type: 'UPDATE_CANVAS_SIZE', width, height }),
    updateCanvasBackground: (backgroundColor: string) => dispatch({ type: 'UPDATE_CANVAS_BACKGROUND', backgroundColor }),
    updatePlatformMetadata: (patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_DOCUMENT_PLATFORM_METADATA', patch }),
    updateReleaseSettings: (patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_RELEASE_SETTINGS', patch }),
    applyDocumentVariantRules: (context: VariantContext, rules?: VariantRule[]) => dispatch({ type: 'APPLY_DOCUMENT_VARIANT_RULES', context, rules }),
    setShareLink: (shareLink: string) => dispatch({ type: 'SET_SHARE_LINK', shareLink }),
    markAutosaved: (at: string) => dispatch({ type: 'MARK_DOCUMENT_AUTOSAVED', at }),
    setTimelineMode: (timelineMode: StudioPreferences['timelineMode']) => dispatch({ type: 'SET_TIMELINE_MODE', timelineMode }),
  }), []);
}

export function useSceneActions() {
  const engine = useOptionalAnimationEngine();
  const stateRef = useStudioStoreRef((state) => state);
  const transitionTimerRef = useRef<number>(0);
  const pendingTransitionRef = useRef<{ sourceSceneId: string; targetSceneId: string } | null>(null);

  useEffect(() => () => {
    if (transitionTimerRef.current) {
      globalThis.clearTimeout(transitionTimerRef.current);
      transitionTimerRef.current = 0;
    }
    pendingTransitionRef.current = null;
  }, []);

  return useMemo(() => {
    const clearPendingTransition = () => {
      if (transitionTimerRef.current) {
        globalThis.clearTimeout(transitionTimerRef.current);
        transitionTimerRef.current = 0;
      }
      pendingTransitionRef.current = null;
    };

    const finalizeSceneSelection = (sceneId: string) => {
      clearPendingTransition();
      dispatch({ type: 'SELECT_SCENE', sceneId });
    };

    const maybeTransitionToScene = (sceneId: string | undefined) => {
      if (!sceneId) return;
      const state = stateRef.current;
      const sourceSceneId = state.document.selection.activeSceneId;
      console.log('[SceneActions] maybeTransitionToScene', { sceneId, sourceSceneId, isSame: sceneId === sourceSceneId, sceneExists: state.document.scenes.some((s) => s.id === sceneId) });
      if (!sceneId || sceneId === sourceSceneId) return;

      const shouldAnimateExit = Boolean(engine) && state.ui.previewMode && state.ui.isPlaying;
      if (!shouldAnimateExit) {
        finalizeSceneSelection(sceneId);
        return;
      }

      const pendingTransition = pendingTransitionRef.current;
      if (pendingTransition?.sourceSceneId === sourceSceneId && pendingTransition.targetSceneId === sceneId) {
        return;
      }

      const sceneWidgets = getSceneWidgets(state, sourceSceneId);
      const exitDurationMs = resolveSceneExitDurationMs(sceneWidgets);
      const realTimeMs = nowMs();
      const clock = createEventClock('scene-exit', realTimeMs, 'exit');

      sceneWidgets.forEach((widget) => {
        engine?.emit({
          trigger: 'scene-exit',
          sourceId: widget.id,
          targetId: widget.id,
          sceneTimeMs: state.ui.playheadMs,
          realTimeMs,
          clock,
        });
      });

      clearPendingTransition();
      pendingTransitionRef.current = { sourceSceneId, targetSceneId: sceneId };

      if (!exitDurationMs) {
        finalizeSceneSelection(sceneId);
        return;
      }

      transitionTimerRef.current = globalThis.setTimeout(() => {
        const pending = pendingTransitionRef.current;
        if (!pending || pending.sourceSceneId !== sourceSceneId || pending.targetSceneId !== sceneId) return;
        finalizeSceneSelection(sceneId);
      }, exitDurationMs);
    };

    return {
      selectScene: (sceneId: string) => maybeTransitionToScene(sceneId),
      previousScene: () => maybeTransitionToScene(resolvePreviousSceneId(stateRef.current)),
      nextScene: () => maybeTransitionToScene(resolveNextSceneId(stateRef.current, stateRef.current.document.selection.activeSceneId)),
      addScene: () => dispatch({ type: 'ADD_SCENE' }),
      addSceneFromCurrent: () => dispatch({ type: 'ADD_SCENE_FROM_CURRENT' }),
      duplicateScene: (sceneId: string) => dispatch({ type: 'DUPLICATE_SCENE', sceneId }),
      deleteScene: (sceneId: string) => dispatch({ type: 'DELETE_SCENE', sceneId }),
      reorderScenes: (fromIndex: number, toIndex: number) => dispatch({ type: 'REORDER_SCENES', fromIndex, toIndex }),
      updateScene: (sceneId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_SCENE', sceneId, patch }),
    };
  }, [engine, stateRef]);
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
    updateWidgetMotion: (widgetId: string, motion: import('../domain/document/types').WidgetMotion | undefined) => dispatch({ type: 'UPDATE_WIDGET_MOTION', widgetId, motion }),
    updateWidgetHoverMotion: (widgetId: string, hoverMotion: import('../domain/document/types').WidgetHoverMotion | undefined) => dispatch({ type: 'UPDATE_WIDGET_HOVER_MOTION', widgetId, hoverMotion }),
    updateWidgetTiming: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_TIMING', widgetId, patch }),
    updateWidgetBinding: (widgetId: string, key: string, binding?: WidgetBinding) => dispatch({ type: 'UPDATE_WIDGET_BINDING', widgetId, key, binding }),
    updateWidgetVariant: (widgetId: string, variant: VariantName, area: 'props' | 'style', patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_VARIANT', widgetId, variant, area, patch }),
    updateWidgetConditions: (widgetId: string, patch: Record<string, unknown>) => dispatch({ type: 'UPDATE_WIDGET_CONDITIONS', widgetId, patch }),
    toggleWidgetHidden: (widgetId: string) => dispatch({ type: 'TOGGLE_WIDGET_HIDDEN', widgetId }),
    toggleWidgetLocked: (widgetId: string) => dispatch({ type: 'TOGGLE_WIDGET_LOCKED', widgetId }),
    reorderWidget: (widgetId: string, direction: 'forward' | 'backward' | 'front' | 'back') => dispatch({ type: 'REORDER_WIDGET', widgetId, direction }),
    groupSelected: () => dispatch({ type: 'GROUP_SELECTED_WIDGETS' }),
    ungroupSelected: () => dispatch({ type: 'UNGROUP_SELECTED_WIDGETS' }),
    convertWidgetToSharedLayer: (widgetId: string) => dispatch({ type: 'CONVERT_WIDGET_TO_SHARED_LAYER', widgetId }),
    duplicateSelected: () => dispatch({ type: 'DUPLICATE_SELECTED_WIDGETS' }),
    pasteClipboard: (clipboard: WidgetClipboardPayload) => dispatch({ type: 'PASTE_WIDGET_CLIPBOARD', clipboard }),
    applyPropertyClipboard: (widgetId: string, clipboard: WidgetPropertyClipboardPayload) => dispatch({ type: 'APPLY_WIDGET_PROPERTY_CLIPBOARD', widgetId, clipboard }),
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
    setWidgetKeyframes: (widgetId: string, keyframes: KeyframeNode[]) => dispatch({ type: 'SET_WIDGET_KEYFRAMES', widgetId, keyframes }),
    updateKeyframe: (widgetId: string, keyframeId: string, patch: { atMs?: number; value?: number; easing?: KeyframeEasing }) => dispatch({ type: 'UPDATE_KEYFRAME', widgetId, keyframeId, patch }),
    removeKeyframe: (widgetId: string, keyframeId: string) => dispatch({ type: 'REMOVE_KEYFRAME', widgetId, keyframeId }),
  }), []);
}

export function useUiActions() {
  return useMemo(() => ({
    setPreviewMode: (previewMode: boolean) => dispatch({ type: 'SET_PREVIEW_MODE', previewMode }),
    setPreviewContext: (previewContext: import('../domain/preview/preview-frames').PreviewFrameId) => dispatch({ type: 'SET_PREVIEW_CONTEXT', previewContext }),
    setEditModeWireframe: (enabled: boolean) => dispatch({ type: 'SET_EDIT_MODE_WIREFRAME', enabled }),
    setPlaying: (isPlaying: boolean) => dispatch({ type: 'SET_PLAYING', isPlaying }),
    setZoom: (zoom: number) => dispatch({ type: 'SET_ZOOM', zoom }),
    setActiveVariant: (variant: VariantName) => dispatch({ type: 'SET_ACTIVE_VARIANT', variant }),
    setActiveFeedSource: (source: BindingSource) => dispatch({ type: 'SET_ACTIVE_FEED_SOURCE', source }),
    setActiveFeedRecord: (recordId: string) => dispatch({ type: 'SET_ACTIVE_FEED_RECORD', recordId }),
    setLeftTab: (tab: import('../domain/document/types').StudioState['ui']['activeLeftTab']) => dispatch({ type: 'SET_LEFT_TAB', tab }),
    setStageBackdrop: (stageBackdrop: import('../domain/document/types').StudioState['ui']['stageBackdrop']) => dispatch({ type: 'SET_STAGE_BACKDROP', stageBackdrop }),
    setStageRulers: (enabled: boolean) => dispatch({ type: 'SET_STAGE_RULERS', enabled }),
    setWidgetBadgesVisibility: (enabled: boolean) => dispatch({ type: 'SET_WIDGET_BADGES_VISIBILITY', enabled }),
    setInspectorFocus: (focus: { widgetId?: string; tab?: 'basics' | 'behavior' | 'data'; keyframeId?: string }) => dispatch({ type: 'SET_INSPECTOR_FOCUS', ...focus }),
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
