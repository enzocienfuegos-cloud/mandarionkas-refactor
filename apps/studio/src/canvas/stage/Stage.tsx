import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useStageController, type ResizeHandle } from './use-stage-controller';
import { ZOOM_MAX, ZOOM_MIN } from './controllers/stage-viewport';
import { StageRulers } from './components/StageRulers';
import { StageFloatingToolbar } from './components/StageFloatingToolbar';
import { StageSurface, type StageSurfaceProps } from './components/StageSurface';
import { StageSelectionToolbar } from './components/StageSelectionToolbar';
import { StagePreviewShell } from './components/StagePreviewShell';
import { StageCanvasQuickPanel } from './components/StageCanvasQuickPanel';
import { clampFloatingPanelPosition } from './components/stage-utils';
import type { WidgetNode } from '../../domain/document/types';
import { usePlatformPermission } from '../../platform/runtime';
import { getLiveWidgetFrame } from '../../domain/document/timeline';
import { useDocumentActions } from '../../hooks/use-studio-actions';
import { getCapability } from '../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { widgetAcceptsAssetSwap } from '../../app/shell/left-rail/asset-controller-helpers';
import {
  isStageInteractiveOverlayTarget,
  isStageWidgetTarget,
  isWithinCanvasQuickPanelTarget,
  isWithinStageSurfaceTarget,
  isWithinStageToolbarTarget,
} from './stage-interaction-targets';
import {
  readEditModeWireframePreference,
  writeEditModeWireframePreference,
} from './stage-view-preferences';
import { getPreviewFrame, type PreviewFrame } from '../../domain/preview/preview-frames';
import { useStageToolbarDrag } from './use-stage-toolbar-drag';

const stageWrap: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100%' };

function getPreviewCanvasFitScale(frame: PreviewFrame, canvas: { width: number; height: number }): number {
  if (frame.id === 'none') return 1;
  return Math.min(1, frame.placement.width / canvas.width, frame.placement.height / canvas.height);
}

type StageProps = {
  onOpenAssetLibrary(): void;
};

export function Stage({ onOpenAssetLibrary }: StageProps): JSX.Element {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
  const didRestoreWireframePreferenceRef = useRef(false);
  const [workspaceViewport, setWorkspaceViewport] = useState({ width: 0, height: 0 });
  const [toolbarBounds, setToolbarBounds] = useState({ width: 520, height: 176 });
  const [selectionToolbarBounds, setSelectionToolbarBounds] = useState({ width: 160, height: 36 });
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const [showCanvasQuickPanel, setShowCanvasQuickPanel] = useState(false);
  const canCreateAssets = usePlatformPermission('assets:create');
  const documentActions = useDocumentActions();
  const {
    stageState,
    fullStateRef,
    marquee,
    sceneTransitionActive,
    liveFrameById,
    fitToViewport,
    handleWorkspaceWheel,
    panModeActive,
    isPanning,
    handleWorkspacePointerDownCapture,
    handleWorkspacePointerMove,
    handleWorkspacePointerUp,
    handleWorkspacePointerCancel,
    beginMarqueeSelection,
    beginWidgetDrag,
    beginWidgetResize,
    dropPreview,
    handleStageDragOver,
    handleStageDragLeave,
    handleStageDrop,
    isWidgetVisible,
    uiActions,
    sceneActions,
    widgetActions,
  } = useStageController(workspaceRef, stageRef);

  const {
    canvas,
    scene,
    widgets,
    selectedIds,
    zoom,
    playheadMs,
    previewMode,
    previewContext,
    editModeWireframe,
    hoveredWidgetId,
    activeWidgetId,
    stageBackdrop,
    showStageRulers,
    showWidgetBadges,
  } = stageState;
  const selectedWidget = !previewMode && selectedIds.length === 1 ? widgets.find((widget) => widget.id === selectedIds[0]) : undefined;
  const previewFrame = getPreviewFrame(previewContext);
  const activePreviewFrame = previewMode ? previewFrame : getPreviewFrame('none');
  const previewCanvasFitScale = previewMode ? getPreviewCanvasFitScale(activePreviewFrame, canvas) : 1;
  const effectiveStageZoom = zoom * previewCanvasFitScale;
  const stageWidth = canvas.width * effectiveStageZoom;
  const stageHeight = canvas.height * effectiveStageZoom;
  const previewShellWidth = activePreviewFrame.id === 'none' ? stageWidth : activePreviewFrame.chromeWidth * zoom;
  const previewShellHeight = activePreviewFrame.id === 'none' ? stageHeight : activePreviewFrame.chromeHeight * zoom;
  const previewPlacementStyle = activePreviewFrame.id === 'none'
    ? undefined
    : {
        left: activePreviewFrame.placement.x * zoom,
        top: activePreviewFrame.placement.y * zoom,
        width: activePreviewFrame.placement.width * zoom,
        height: activePreviewFrame.placement.height * zoom,
      } satisfies CSSProperties;
  const previewFrameStyle = activePreviewFrame.id === 'none'
    ? undefined
    : {
        width: activePreviewFrame.chromeWidth * zoom,
        height: activePreviewFrame.chromeHeight * zoom,
        ['--preview-safe-area-top' as string]: `${(activePreviewFrame.safeAreaTop ?? 0) * zoom}px`,
        ['--preview-safe-area-bottom' as string]: `${(activePreviewFrame.safeAreaBottom ?? 0) * zoom}px`,
      } satisfies CSSProperties;

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;

    const updateViewport = () => {
      setWorkspaceViewport({ width: element.clientWidth, height: element.clientHeight });
    };

    updateViewport();
    const resizeObserver = new ResizeObserver(updateViewport);
    resizeObserver.observe(element);
    window.addEventListener('resize', updateViewport);
    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', updateViewport);
    };
  }, []);

  useEffect(() => {
    const element = workspaceRef.current;
    if (!element) return;
    const listener = (event: WheelEvent) => handleWorkspaceWheel(event);
    element.addEventListener('wheel', listener, { passive: false });
    return () => element.removeEventListener('wheel', listener);
  }, [handleWorkspaceWheel]);

  useEffect(() => {
    const element = toolbarRef.current;
    if (!element) return;

    const updateToolbarBounds = () => {
      setToolbarBounds({
        width: Math.ceil(element.offsetWidth),
        height: Math.ceil(element.offsetHeight),
      });
    };

    updateToolbarBounds();
    const resizeObserver = new ResizeObserver(updateToolbarBounds);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [toolbarCollapsed]);

  useEffect(() => {
    const element = selectionToolbarRef.current;
    if (!element) return;

    const updateSelectionToolbarBounds = () => {
      setSelectionToolbarBounds({
        width: Math.ceil(element.offsetWidth),
        height: Math.ceil(element.offsetHeight),
      });
    };

    updateSelectionToolbarBounds();
    const resizeObserver = new ResizeObserver(updateSelectionToolbarBounds);
    resizeObserver.observe(element);
    return () => resizeObserver.disconnect();
  }, [selectedWidget?.id]);

  useEffect(() => {
    if (didRestoreWireframePreferenceRef.current) return;
    const persisted = readEditModeWireframePreference(editModeWireframe);
    if (persisted !== editModeWireframe) {
      uiActions.setEditModeWireframe(persisted);
    }
    didRestoreWireframePreferenceRef.current = true;
  }, [editModeWireframe, uiActions]);

  useEffect(() => {
    if (!didRestoreWireframePreferenceRef.current) return;
    writeEditModeWireframePreference(editModeWireframe);
  }, [editModeWireframe]);

  useEffect(() => {
    if (previewMode || selectedIds.length > 0) {
      setShowCanvasQuickPanel(false);
    }
  }, [previewMode, selectedIds.length]);

  const selectionToolbarPosition = useMemo(() => {
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    if (!workspace || !stage || !selectedWidget) return null;
    const workspaceRect = workspace.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const frame = liveFrameById[selectedWidget.id] ?? getLiveWidgetFrame(selectedWidget, playheadMs);
    const rawX = stageRect.left - workspaceRect.left + (frame.x + frame.width / 2) * zoom - selectionToolbarBounds.width / 2;
    const rawY = stageRect.top - workspaceRect.top + frame.y * zoom - selectionToolbarBounds.height - 8;
    return clampFloatingPanelPosition(
      { x: rawX, y: rawY },
      workspaceViewport,
      selectionToolbarBounds,
    );
  }, [liveFrameById, playheadMs, selectedWidget, selectionToolbarBounds, workspaceViewport, zoom]);

  const { beginToolbarDrag, endToolbarDrag, onToolbarPointerMove, toolbarStyle } = useStageToolbarDrag(workspaceViewport, toolbarBounds);

  const openAssetPicker = (widget: WidgetNode) => {
    if (!widgetAcceptsAssetSwap(widget)) return;
    widgetActions.selectWidget(widget.id);
    widgetActions.setActiveWidget(widget.id);
    onOpenAssetLibrary();
  };

  const handleStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (isStageWidgetTarget(target) || isStageInteractiveOverlayTarget(target)) {
      return;
    }
    widgetActions.selectWidget(null);
    if (previewMode) {
      setShowCanvasQuickPanel(false);
      return;
    }
    setShowCanvasQuickPanel(true);
    if (event.pointerType !== 'touch') {
      beginMarqueeSelection(event.nativeEvent);
    }
  };

  const handleWidgetPointerDown = (event: ReactPointerEvent<HTMLDivElement>, widgetId: string, locked: boolean) => {
    event.stopPropagation();
    setShowCanvasQuickPanel(false);
    const additive = event.shiftKey || event.metaKey || event.ctrlKey;
    beginWidgetDrag(event.nativeEvent, widgetId, locked, additive);
  };

  const handleResizePointerDown = (
    event: ReactPointerEvent<HTMLButtonElement>,
    widgetId: string,
    locked: boolean,
    handle: ResizeHandle,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setShowCanvasQuickPanel(false);
    beginWidgetResize(event.nativeEvent, widgetId, locked, handle);
  };

  const stageSurfaceProps: StageSurfaceProps = {
    stageRef,
    canvas,
    widgets,
    selectedIds,
    previewMode,
    editModeWireframe,
    zoom: effectiveStageZoom,
    playheadMs,
    sceneDurationMs: scene.durationMs,
    sceneTransitionType: scene.transition?.type ?? 'cut',
    sceneTransitionDurationMs: scene.transition?.durationMs ?? 450,
    sceneTransitionActive,
    marquee,
    dropPreview,
    liveFrameById,
    hoveredWidgetId,
    activeWidgetId,
    showStageRulers,
    showWidgetBadges,
    stateRef: fullStateRef,
    isWidgetVisible,
    onStagePointerDown: handleStagePointerDown,
    onStageDragOver: handleStageDragOver,
    onStageDragLeave: handleStageDragLeave,
    onStageDrop: handleStageDrop,
    onWidgetPointerDown: handleWidgetPointerDown,
    onResizePointerDown: handleResizePointerDown,
    onSetActiveWidget: widgetActions.setActiveWidget,
    onSetHoveredWidget: widgetActions.setHoveredWidget,
    onExecuteAction: widgetActions.executeAction,
  };

  return (
    <div
      className={`workspace-shell workspace-shell-backdrop-${stageBackdrop} ${showStageRulers ? 'has-workspace-rulers' : ''} ${panModeActive ? 'is-pan-mode' : ''} ${isPanning ? 'is-panning' : ''}`}
      ref={workspaceRef}
      onPointerDownCapture={(event) => {
        handleWorkspacePointerDownCapture(event);
        const target = event.target as HTMLElement | null;
        const insidePanel = isWithinCanvasQuickPanelTarget(target);
        const insideStage = isWithinStageSurfaceTarget(target);
        const insideToolbar = isWithinStageToolbarTarget(target);
        if (!insidePanel && !insideStage && !insideToolbar) {
          widgetActions.selectWidget(null);
          setShowCanvasQuickPanel(false);
        }
      }}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={handleWorkspacePointerUp}
      onPointerCancel={handleWorkspacePointerCancel}
    >
      {showStageRulers ? <StageRulers workspaceWidth={workspaceViewport.width} workspaceHeight={workspaceViewport.height} /> : null}
      <div className="workspace-inner">
        <div style={stageWrap}>
          <StagePreviewShell
            activePreviewFrame={activePreviewFrame}
            previewShellWidth={previewShellWidth}
            previewShellHeight={previewShellHeight}
            previewFrameStyle={previewFrameStyle}
            previewPlacementStyle={previewPlacementStyle}
            stageSurface={<StageSurface {...stageSurfaceProps} />}
          >
            {showCanvasQuickPanel ? (
              <StageCanvasQuickPanel
                canvas={canvas}
                onUpdateBackground={documentActions.updateCanvasBackground}
              />
            ) : null}
          </StagePreviewShell>
        </div>
      </div>
      {selectedWidget && selectionToolbarPosition ? (
        <StageSelectionToolbar
          ref={selectionToolbarRef}
          widget={selectedWidget}
          position={selectionToolbarPosition}
          uploadDisabled={!canCreateAssets}
          onToggleVisibility={() => widgetActions.toggleWidgetHidden(selectedWidget.id)}
          onToggleLock={() => widgetActions.toggleWidgetLocked(selectedWidget.id)}
          onUngroup={() => widgetActions.ungroupSelected()}
          onDuplicate={() => widgetActions.duplicateSelected()}
          onMoveBackward={() => widgetActions.reorderWidget(selectedWidget.id, 'backward')}
          onMoveForward={() => widgetActions.reorderWidget(selectedWidget.id, 'forward')}
          onUploadAsset={() => openAssetPicker(selectedWidget)}
          onOpenAssetLibrary={onOpenAssetLibrary}
          onDelete={() => widgetActions.deleteSelected()}
        />
      ) : null}
      <StageFloatingToolbar
        toolbarRef={toolbarRef}
        toolbarCollapsed={toolbarCollapsed}
        toolbarStyle={toolbarStyle}
        sceneName={scene.name}
        stageBackdrop={stageBackdrop}
        showStageRulers={showStageRulers}
        editModeWireframe={editModeWireframe}
        zoom={zoom}
        onPointerDown={beginToolbarDrag}
        onPointerMove={onToolbarPointerMove}
        onPointerUp={endToolbarDrag}
        onPointerCancel={endToolbarDrag}
        onToggleCollapsed={() => setToolbarCollapsed((current) => !current)}
        onPreviousScene={() => sceneActions.previousScene()}
        onNextScene={() => sceneActions.nextScene()}
        onToggleRulers={() => uiActions.setStageRulers(!showStageRulers)}
        onToggleWireframe={() => uiActions.setEditModeWireframe(!editModeWireframe)}
        onSetBackdrop={(tone) => uiActions.setStageBackdrop(tone)}
        onZoomOut={() => uiActions.setZoom(Math.max(ZOOM_MIN, zoom - 0.1))}
        onZoomIn={() => uiActions.setZoom(Math.min(ZOOM_MAX, zoom + 0.1))}
        onFitToViewport={fitToViewport}
      />
    </div>
  );
}
