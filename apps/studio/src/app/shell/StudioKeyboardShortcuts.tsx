import { Suspense, lazy, useMemo } from 'react';
import { triggerExportZipBundleResolved } from '../../export/engine';
import type { StudioState } from '../../domain/document/types';
import { useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { useTimelineActions } from '../../hooks/use-studio-actions';
import { useToast } from '../../shared/ui/ToastProvider';
import { clampZoom } from '../../canvas/stage/controllers/stage-viewport';
import { buildWidgetClipboardPayload, getWidgetClipboardPayload, setWidgetClipboardPayload } from '../../canvas/stage/widget-clipboard';
import { useStudioStore, useStudioStoreRef, shallowEqual } from '../../core/store/use-studio-store';
import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';
import { SHORTCUT_CATALOG } from './shortcut-catalog';
import { type ShortcutBinding, useKeyboardShortcuts } from './use-keyboard-shortcuts';
import { useTopBarController } from './topbar/use-top-bar-controller';
import { getPreviewFrame, type PreviewFrameId } from '../../domain/preview/preview-frames';

const KeyboardShortcutsModal = lazy(async () => import('./KeyboardShortcutsModal').then((module) => ({ default: module.KeyboardShortcutsModal })));

function getActiveSceneWidgets(state: StudioState) {
  const widgetsById = buildResolvedWidgetsById(state.document);
  const activeScene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
  return activeScene.widgetIds
    .map((widgetId) => widgetsById[widgetId])
    .filter((widget): widget is StudioState['document']['widgets'][string] => Boolean(widget))
    .sort((left, right) => left.zIndex - right.zIndex);
}

function getMovableSelectionIds(state: StudioState): string[] {
  const selectedIds = new Set(state.document.selection.widgetIds);
  const widgetsById = buildResolvedWidgetsById(state.document);
  return state.document.selection.widgetIds.filter((widgetId) => {
    const widget = widgetsById[widgetId];
    if (!widget || widget.locked) return false;
    let ancestorId = widget.parentId;
    while (ancestorId) {
      if (selectedIds.has(ancestorId)) return false;
      ancestorId = widgetsById[ancestorId]?.parentId;
    }
    return true;
  });
}

function buildNudgePatches(state: StudioState, dx: number, dy: number) {
  const widgetsById = buildResolvedWidgetsById(state.document);
  return getMovableSelectionIds(state)
    .map((widgetId) => widgetsById[widgetId])
    .filter((widget): widget is StudioState['document']['widgets'][string] => Boolean(widget))
    .map((widget) => ({
      widgetId: widget.id,
      patch: {
        x: widget.frame.x + dx,
        y: widget.frame.y + dy,
      },
    }));
}

function fitZoomForWorkspace(
  workspace: HTMLDivElement,
  canvas: { width: number; height: number },
  previewMode: boolean,
  previewContext: PreviewFrameId,
): number {
  const bounds = workspace.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return 1;
  const previewFrame = previewMode ? getPreviewFrame(previewContext) : getPreviewFrame('none');
  const frameWidth = previewFrame.id === 'none' ? canvas.width : previewFrame.chromeWidth;
  const frameHeight = previewFrame.id === 'none' ? canvas.height : previewFrame.chromeHeight;
  return clampZoom(Math.min(
    Math.max(1, bounds.width - 96) / frameWidth,
    Math.max(1, bounds.height - 96) / frameHeight,
    1,
  ));
}

export function StudioKeyboardShortcuts({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}): JSX.Element | null {
  const controller = useTopBarController();
  const uiActions = useUiActions();
  const timelineActions = useTimelineActions();
  const widgetActions = useWidgetActions();
  const { pushToast } = useToast();
  const stateRef = useStudioStoreRef((state) => state);
  const { previewMode, previewContext, editModeWireframe, zoom, canvas, isPlaying } = useStudioStore((state) => ({
    previewMode: state.ui.previewMode,
    previewContext: state.ui.previewContext,
    editModeWireframe: state.ui.editModeWireframe,
    zoom: state.ui.zoom,
    canvas: state.document.canvas,
    isPlaying: state.ui.isPlaying,
  }), shallowEqual);

  const bindings = useMemo<ShortcutBinding[]>(() => {
    const runSave = () => {
      if (!controller.workspace.canSaveProjects) return;
      void controller.projectSession.handleSaveProject()
        .then(() => {
          pushToast({
            title: 'Project saved',
            description: 'The latest changes are now stored in the workspace.',
            tone: 'success',
          });
        })
        .catch((error) => {
          pushToast({
            title: 'Save failed',
            description: error instanceof Error ? error.message : 'Unable to save this project.',
            tone: 'danger',
          });
        });
    };

    const runExport = () => {
      void triggerExportZipBundleResolved(stateRef.current)
        .then((filename) => {
          pushToast({
            title: 'Export ready',
            description: `Built ${stateRef.current.document.metadata.release.targetChannel} package as ${filename}.`,
            tone: 'success',
          });
        })
        .catch((error) => {
          pushToast({
            title: 'Export failed',
            description: error instanceof Error ? error.message : 'Unable to build the export package.',
            tone: 'danger',
          });
        });
    };

    const cycleSelection = (direction: 'forward' | 'backward') => {
      const state = stateRef.current;
      if (state.ui.previewMode) return;
      const visibleWidgets = getActiveSceneWidgets(state).filter((widget) => !widget.hidden);
      if (!visibleWidgets.length) return;
      const currentId = state.document.selection.primaryWidgetId ?? state.document.selection.widgetIds[0];
      const currentIndex = visibleWidgets.findIndex((widget) => widget.id === currentId);
      const fallbackIndex = direction === 'forward' ? 0 : visibleWidgets.length - 1;
      const nextIndex = currentIndex === -1
        ? fallbackIndex
        : (currentIndex + (direction === 'forward' ? 1 : -1) + visibleWidgets.length) % visibleWidgets.length;
      widgetActions.selectWidget(visibleWidgets[nextIndex]?.id ?? null);
    };

    const nudgeSelection = (dx: number, dy: number) => {
      const state = stateRef.current;
      if (state.ui.previewMode) return;
      const patches = buildNudgePatches(state, dx, dy);
      if (!patches.length) return;
      widgetActions.updateWidgetFrames(patches);
    };

    const reorderSelection = (direction: 'forward' | 'backward') => {
      const state = stateRef.current;
      if (state.ui.previewMode) return;
      const widgetId = state.document.selection.primaryWidgetId ?? state.document.selection.widgetIds[0];
      if (!widgetId) return;
      widgetActions.reorderWidget(widgetId, direction);
    };

    const togglePlayback = () => {
      const state = stateRef.current;
      const activeScene = state.document.scenes.find((item) => item.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
      if (!state.ui.previewMode) {
        uiActions.setPreviewMode(true);
        return;
      }
      if (state.ui.isPlaying) {
        timelineActions.setPlaying(false);
        return;
      }
      if (state.ui.playheadMs >= activeScene.durationMs) {
        timelineActions.setPlayhead(0);
      }
      timelineActions.setPlaying(true);
    };

    return [
      { combo: 'cmd+z', action: () => uiActions.undo(), enabled: () => !open },
      { combo: 'cmd+shift+z', action: () => uiActions.redo(), enabled: () => !open },
      { combo: 'cmd+c', action: () => {
        const payload = buildWidgetClipboardPayload(stateRef.current);
        if (payload) setWidgetClipboardPayload(payload);
      }, enabled: () => !open },
      { combo: 'cmd+v', action: () => {
        const payload = getWidgetClipboardPayload();
        if (payload) widgetActions.pasteClipboard(payload);
      }, enabled: () => !open },
      { combo: 'delete', action: () => widgetActions.deleteSelected(), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'backspace', action: () => widgetActions.deleteSelected(), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'cmd+d', action: () => widgetActions.duplicateSelected(), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0 },
      { combo: 'cmd+g', action: () => widgetActions.groupSelected(), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 1 },
      { combo: 'cmd+shift+g', action: () => widgetActions.ungroupSelected(), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0 },
      { combo: '[', action: () => reorderSelection('backward'), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: ']', action: () => reorderSelection('forward'), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'arrowup', action: () => nudgeSelection(0, -1), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'arrowdown', action: () => nudgeSelection(0, 1), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'arrowleft', action: () => nudgeSelection(-1, 0), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'arrowright', action: () => nudgeSelection(1, 0), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'shift+arrowup', action: () => nudgeSelection(0, -10), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'shift+arrowdown', action: () => nudgeSelection(0, 10), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'shift+arrowleft', action: () => nudgeSelection(-10, 0), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'shift+arrowright', action: () => nudgeSelection(10, 0), enabled: () => !open && !previewMode && stateRef.current.document.selection.widgetIds.length > 0, allowRepeat: true },
      { combo: 'tab', action: () => cycleSelection('forward'), enabled: () => !open, allowRepeat: true },
      { combo: 'shift+tab', action: () => cycleSelection('backward'), enabled: () => !open, allowRepeat: true },
      { combo: 'space', action: () => togglePlayback(), enabled: () => !open },
      { combo: 'w', action: () => uiActions.setEditModeWireframe(!editModeWireframe), enabled: () => !open && !previewMode },
      { combo: 'cmd+0', action: () => {
        const workspace = document.querySelector('.workspace-shell');
        if (workspace instanceof HTMLDivElement) {
          uiActions.setZoom(fitZoomForWorkspace(workspace, canvas, previewMode, previewContext));
        }
      }, enabled: () => !open },
      { combo: 'cmd+=', action: () => uiActions.setZoom(clampZoom(Number((zoom + 0.1).toFixed(2)))), enabled: () => !open, allowRepeat: true },
      { combo: 'cmd+-', action: () => uiActions.setZoom(clampZoom(Number((zoom - 0.1).toFixed(2)))), enabled: () => !open, allowRepeat: true },
      { combo: 'cmd+s', action: () => runSave(), enabled: () => !open },
      { combo: 'cmd+e', action: () => runExport(), enabled: () => !open },
      { combo: '?', action: () => onOpenChange(true), enabled: () => !open },
    ];
  }, [canvas, controller.projectSession, controller.workspace.canSaveProjects, editModeWireframe, isPlaying, onOpenChange, open, previewContext, previewMode, pushToast, stateRef, timelineActions, uiActions, widgetActions, zoom]);

  useKeyboardShortcuts(bindings);

  if (!open) return null;

  return (
    <Suspense fallback={null}>
      <KeyboardShortcutsModal
        open={open}
        shortcuts={SHORTCUT_CATALOG}
        onClose={() => onOpenChange(false)}
      />
    </Suspense>
  );
}
