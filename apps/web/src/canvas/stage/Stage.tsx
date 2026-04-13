import {
  useEffect,
  useRef,
  useState,
  useMemo,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useStageController } from './use-stage-controller';
import { ZOOM_MAX, ZOOM_MIN } from './controllers/stage-viewport';
import { StageRulers } from './components/StageRulers';
import { StageFloatingToolbar } from './components/StageFloatingToolbar';
import { StageSurface } from './components/StageSurface';
import { StageSelectionToolbar } from './components/StageSelectionToolbar';
import type { WidgetNode } from '../../domain/document/types';
import { usePlatformPermission } from '../../platform/runtime';
import { getLiveWidgetFrame } from '../../domain/document/timeline';

const stageWrap: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100%' };

type StageProps = {
  onOpenAssetLibrary(): void;
};

export function Stage({ onOpenAssetLibrary }: StageProps): JSX.Element {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [workspaceViewport, setWorkspaceViewport] = useState({ width: 0, height: 0 });
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
  const [toolbarCollapsed, setToolbarCollapsed] = useState(false);
  const canCreateAssets = usePlatformPermission('assets:create');
  const {
    stageState,
    fullStateRef,
    marquee,
    sceneTransitionActive,
    liveFrameById,
    stageWidth,
    stageHeight,
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

  const { canvas, scene, widgets, selectedIds, zoom, playheadMs, previewMode, hoveredWidgetId, activeWidgetId, stageBackdrop, showStageRulers } = stageState;
  const selectedWidget = !previewMode && selectedIds.length === 1 ? widgets.find((widget) => widget.id === selectedIds[0]) : undefined;

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
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.key !== 'Delete' && event.key !== 'Backspace') || !selectedIds.length) return;
      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isEditable = Boolean(target?.isContentEditable) || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
      if (isEditable) return;
      event.preventDefault();
      widgetActions.deleteSelected();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, widgetActions]);

  useEffect(() => {
    const nextX = Math.max(32, Math.round(workspaceViewport.width / 2 - 240));
    const nextY = Math.max(24, workspaceViewport.height - 130);
    setToolbarPosition((current) => current.x === 0 && current.y === 0 ? { x: nextX, y: nextY } : current);
  }, [workspaceViewport.width, workspaceViewport.height]);

  const selectionToolbarPosition = useMemo(() => {
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    if (!workspace || !stage || !selectedWidget) return null;
    const workspaceRect = workspace.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const frame = liveFrameById[selectedWidget.id] ?? getLiveWidgetFrame(selectedWidget, playheadMs);
    return {
      x: stageRect.left - workspaceRect.left + (frame.x + frame.width / 2) * zoom,
      y: stageRect.top - workspaceRect.top + frame.y * zoom - 18,
    };
  }, [liveFrameById, playheadMs, selectedWidget, zoom, workspaceViewport.width, workspaceViewport.height]);

  const clampToolbarPosition = (x: number, y: number) => ({
    x: Math.max(12, Math.min(x, Math.max(12, workspaceViewport.width - 520))),
    y: Math.max(12, Math.min(y, Math.max(12, workspaceViewport.height - (toolbarCollapsed ? 68 : 176)))),
  });

  const beginToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!target.closest('.workspace-toolbar-drag-handle')) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: toolbarPosition.x,
      originY: toolbarPosition.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onToolbarPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const next = clampToolbarPosition(
      dragState.originX + (event.clientX - dragState.startX),
      dragState.originY + (event.clientY - dragState.startY),
    );
    setToolbarPosition(next);
  };

  const endToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  const toolbarStyle: CSSProperties = { left: toolbarPosition.x, top: toolbarPosition.y, transform: 'none' };

  const openAssetPicker = (widget: WidgetNode) => {
    if (widget.type !== 'image' && widget.type !== 'hero-image' && widget.type !== 'video-hero') return;
    widgetActions.setActiveWidget(widget.id);
    onOpenAssetLibrary();
  };

  return (
    <div
      className={`workspace-shell workspace-shell-backdrop-${stageBackdrop} ${showStageRulers ? 'has-workspace-rulers' : ''} ${panModeActive ? 'is-pan-mode' : ''} ${isPanning ? 'is-panning' : ''}`}
      ref={workspaceRef}
      onPointerDownCapture={handleWorkspacePointerDownCapture}
      onPointerMove={handleWorkspacePointerMove}
      onPointerUp={handleWorkspacePointerUp}
      onPointerCancel={handleWorkspacePointerCancel}
    >
      {showStageRulers ? <StageRulers workspaceWidth={workspaceViewport.width} workspaceHeight={workspaceViewport.height} /> : null}
      <div className="workspace-inner">
        <div style={stageWrap}>
          <div className="stage-size-shell" style={{ width: stageWidth, height: stageHeight }}>
            <StageSurface
              stageRef={stageRef}
              canvas={canvas}
              widgets={widgets}
              selectedIds={selectedIds}
              previewMode={previewMode}
              zoom={zoom}
              playheadMs={playheadMs}
              sceneDurationMs={scene.durationMs}
              sceneTransitionType={scene.transition?.type ?? 'cut'}
              sceneTransitionDurationMs={scene.transition?.durationMs ?? 450}
              sceneTransitionActive={sceneTransitionActive}
              marquee={marquee}
              dropPreview={dropPreview}
              liveFrameById={liveFrameById}
              hoveredWidgetId={hoveredWidgetId}
              activeWidgetId={activeWidgetId}
              showStageRulers={showStageRulers}
              stateRef={fullStateRef}
              isWidgetVisible={isWidgetVisible}
              onStagePointerDown={(event) => {
                if (event.target === event.currentTarget) {
                  beginMarqueeSelection(event.nativeEvent);
                }
              }}
              onStageDragOver={handleStageDragOver}
              onStageDragLeave={handleStageDragLeave}
              onStageDrop={handleStageDrop}
              onWidgetPointerDown={(event, widgetId, locked) => {
                event.stopPropagation();
                const additive = event.shiftKey || event.metaKey || event.ctrlKey;
                beginWidgetDrag(event.nativeEvent, widgetId, locked, additive);
              }}
              onResizePointerDown={(event, widgetId, locked, handle) => {
                event.stopPropagation();
                event.preventDefault();
                beginWidgetResize(event.nativeEvent, widgetId, locked, handle);
              }}
              onSetActiveWidget={widgetActions.setActiveWidget}
              onSetHoveredWidget={widgetActions.setHoveredWidget}
              onExecuteAction={widgetActions.executeAction}
            />
          </div>
        </div>
      </div>
      {selectedWidget && selectionToolbarPosition ? (
        <StageSelectionToolbar
          widget={selectedWidget}
          position={selectionToolbarPosition}
          uploadDisabled={!canCreateAssets}
          onToggleVisibility={() => widgetActions.toggleWidgetHidden(selectedWidget.id)}
          onToggleLock={() => widgetActions.toggleWidgetLocked(selectedWidget.id)}
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
        zoom={zoom}
        onPointerDown={beginToolbarDrag}
        onPointerMove={onToolbarPointerMove}
        onPointerUp={endToolbarDrag}
        onPointerCancel={endToolbarDrag}
        onToggleCollapsed={() => setToolbarCollapsed((current) => !current)}
        onPreviousScene={() => sceneActions.previousScene()}
        onNextScene={() => sceneActions.nextScene()}
        onToggleRulers={() => uiActions.setStageRulers(!showStageRulers)}
        onSetBackdrop={(tone) => uiActions.setStageBackdrop(tone)}
        onZoomOut={() => uiActions.setZoom(Math.max(ZOOM_MIN, zoom - 0.1))}
        onZoomIn={() => uiActions.setZoom(Math.min(ZOOM_MAX, zoom + 0.1))}
        onFitToViewport={fitToViewport}
      />
    </div>
  );
}
