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
import { StageSurface } from './components/StageSurface';
import { StageSelectionToolbar } from './components/StageSelectionToolbar';
import { clampFloatingPanelPosition } from './components/stage-utils';
import type { WidgetNode } from '../../domain/document/types';
import { usePlatformPermission } from '../../platform/runtime';
import { getLiveWidgetFrame } from '../../domain/document/timeline';
import { useDocumentActions } from '../../hooks/use-studio-actions';
import { StudioIcon, StudioIcons } from '../../shared/ui/icons';
import { getCapability } from '../../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import {
  createStageInteractionProps,
  isStageInteractiveOverlayTarget,
  isStageToolbarDragHandleTarget,
  isStageWidgetTarget,
  isWithinCanvasQuickPanelTarget,
  isWithinStageSurfaceTarget,
  isWithinStageToolbarTarget,
  STAGE_INTERACTION,
} from './stage-interaction-targets';
import {
  readEditModeWireframePreference,
  writeEditModeWireframePreference,
} from './stage-view-preferences';
import {
  STAGE_BACKGROUND_SWATCHES,
  TRANSPARENT_CANVAS_BACKGROUND,
} from '../../domain/document/canvas-presets';
import { getPreviewFrame, type PreviewFrame } from '../../domain/preview/preview-frames';

const stageWrap: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '100%' };

function getPreviewCanvasFitScale(frame: PreviewFrame, canvas: { width: number; height: number }): number {
  if (frame.id === 'none') return 1;
  return Math.min(1, frame.placement.width / canvas.width, frame.placement.height / canvas.height);
}

function buildPreviewShellStyle(width: number, height: number): CSSProperties {
  return { width, height };
}

function buildStageSwatchStyle(background: string): CSSProperties {
  return { background };
}

type StageProps = {
  onOpenAssetLibrary(): void;
};

export function Stage({ onOpenAssetLibrary }: StageProps): JSX.Element {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const selectionToolbarRef = useRef<HTMLDivElement | null>(null);
  const canvasQuickPanelRef = useRef<HTMLDivElement | null>(null);
  const didRestoreWireframePreferenceRef = useRef(false);
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [workspaceViewport, setWorkspaceViewport] = useState({ width: 0, height: 0 });
  const [toolbarBounds, setToolbarBounds] = useState({ width: 520, height: 176 });
  const [selectionToolbarBounds, setSelectionToolbarBounds] = useState({ width: 160, height: 36 });
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });
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
    const nextX = Math.max(32, Math.round(workspaceViewport.width / 2 - 240));
    const nextY = Math.max(24, workspaceViewport.height - 130);
    setToolbarPosition((current) => current.x === 0 && current.y === 0 ? { x: nextX, y: nextY } : current);
  }, [workspaceViewport.width, workspaceViewport.height]);

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

  const clampToolbarPosition = (x: number, y: number) => clampFloatingPanelPosition(
    { x, y },
    workspaceViewport,
    toolbarBounds,
  );

  useEffect(() => {
    setToolbarPosition((current) => {
      if (current.x === 0 && current.y === 0) return current;
      return clampToolbarPosition(current.x, current.y);
    });
  }, [toolbarBounds.height, toolbarBounds.width, workspaceViewport.height, workspaceViewport.width]);

  const beginToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!isStageToolbarDragHandleTarget(target)) return;
    if (!event.isPrimary) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: toolbarPosition.x,
      originY: toolbarPosition.y,
    };
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
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
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const toolbarStyle: CSSProperties = { left: toolbarPosition.x, top: toolbarPosition.y, transform: 'none' };

  const openAssetPicker = (widget: WidgetNode) => {
    if (!getCapability(getWidgetDefinition(widget.type), 'acceptsAssetSwap')) return;
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
          <div
            className={`stage-size-shell ${activePreviewFrame.id !== 'none' ? `has-preview-frame preview-frame-shell--${activePreviewFrame.type}` : ''}`.trim()}
            style={buildPreviewShellStyle(previewShellWidth, previewShellHeight)}
          >
            {activePreviewFrame.id === 'none' ? (
              <StageSurface
                stageRef={stageRef}
                canvas={canvas}
                widgets={widgets}
                selectedIds={selectedIds}
                previewMode={previewMode}
                editModeWireframe={editModeWireframe}
                zoom={effectiveStageZoom}
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
                showWidgetBadges={showWidgetBadges}
                stateRef={fullStateRef}
                isWidgetVisible={isWidgetVisible}
                onStagePointerDown={handleStagePointerDown}
                onStageDragOver={handleStageDragOver}
                onStageDragLeave={handleStageDragLeave}
                onStageDrop={handleStageDrop}
                onWidgetPointerDown={handleWidgetPointerDown}
                onResizePointerDown={handleResizePointerDown}
                onSetActiveWidget={widgetActions.setActiveWidget}
                onSetHoveredWidget={widgetActions.setHoveredWidget}
                onExecuteAction={widgetActions.executeAction}
              />
            ) : (
              <div
                className={`stage-preview-frame stage-preview-frame--${activePreviewFrame.type}`}
                style={previewFrameStyle}
              >
                {activePreviewFrame.type === 'mobile' ? (
                  <div className="stage-preview-device">
                    <div className="stage-preview-device__notch" aria-hidden="true" />
                    <div className="stage-preview-device__screen">
                      <div className="stage-preview-device__statusbar" aria-hidden="true">
                        <span>9:41</span>
                        <span>5G</span>
                      </div>
                      <div className="stage-preview-device__placement" style={previewPlacementStyle}>
                        <StageSurface
                          stageRef={stageRef}
                          canvas={canvas}
                          widgets={widgets}
                          selectedIds={selectedIds}
                          previewMode={previewMode}
                          editModeWireframe={editModeWireframe}
                          zoom={effectiveStageZoom}
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
                          showWidgetBadges={showWidgetBadges}
                          stateRef={fullStateRef}
                          isWidgetVisible={isWidgetVisible}
                          onStagePointerDown={handleStagePointerDown}
                          onStageDragOver={handleStageDragOver}
                          onStageDragLeave={handleStageDragLeave}
                          onStageDrop={handleStageDrop}
                          onWidgetPointerDown={handleWidgetPointerDown}
                          onResizePointerDown={handleResizePointerDown}
                          onSetActiveWidget={widgetActions.setActiveWidget}
                          onSetHoveredWidget={widgetActions.setHoveredWidget}
                          onExecuteAction={widgetActions.executeAction}
                        />
                      </div>
                      <div className="stage-preview-device__home-indicator" aria-hidden="true" />
                    </div>
                  </div>
                ) : (
                  <div className="stage-preview-browser">
                    <div className="stage-preview-browser__bar" aria-hidden="true">
                      <span className="stage-preview-browser__dot" />
                      <span className="stage-preview-browser__dot" />
                      <span className="stage-preview-browser__dot" />
                      <div className="stage-preview-browser__url">newsroom.example/story/campaign-launch</div>
                    </div>
                    <div className="stage-preview-browser__body">
                      <div className="stage-preview-browser__article">
                        <div className="stage-preview-browser__eyebrow" aria-hidden="true">Sponsored feature</div>
                        <div className="stage-preview-browser__headline" aria-hidden="true" />
                        <div className="stage-preview-browser__dek" aria-hidden="true" />
                        <div className="stage-preview-browser__placement" style={previewPlacementStyle}>
                          <StageSurface
                            stageRef={stageRef}
                            canvas={canvas}
                            widgets={widgets}
                            selectedIds={selectedIds}
                            previewMode={previewMode}
                            editModeWireframe={editModeWireframe}
                            zoom={effectiveStageZoom}
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
                            showWidgetBadges={showWidgetBadges}
                            stateRef={fullStateRef}
                            isWidgetVisible={isWidgetVisible}
                            onStagePointerDown={handleStagePointerDown}
                            onStageDragOver={handleStageDragOver}
                            onStageDragLeave={handleStageDragLeave}
                            onStageDrop={handleStageDrop}
                            onWidgetPointerDown={handleWidgetPointerDown}
                            onResizePointerDown={handleResizePointerDown}
                            onSetActiveWidget={widgetActions.setActiveWidget}
                            onSetHoveredWidget={widgetActions.setHoveredWidget}
                            onExecuteAction={widgetActions.executeAction}
                          />
                        </div>
                        <div className="stage-preview-browser__copyline" aria-hidden="true" />
                        <div className="stage-preview-browser__copyline is-wide" aria-hidden="true" />
                        <div className="stage-preview-browser__copyline" aria-hidden="true" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {showCanvasQuickPanel ? (
              <div
                ref={canvasQuickPanelRef}
                className="stage-canvas-quick-panel"
                {...createStageInteractionProps(STAGE_INTERACTION.quickPanel)}
              >
                <div className="stage-canvas-quick-panel__header">
                  <strong>Canvas background</strong>
                  <span>{canvas.width}×{canvas.height}</span>
                </div>
                <div className="stage-canvas-quick-panel__swatches">
                  <button
                    type="button"
                    className={`stage-canvas-quick-panel__swatch stage-canvas-quick-panel__swatch--transparent ${canvas.backgroundColor === TRANSPARENT_CANVAS_BACKGROUND ? 'is-active' : ''}`}
                    aria-label="Use transparent canvas background"
                    onClick={() => documentActions.updateCanvasBackground(TRANSPARENT_CANVAS_BACKGROUND)}
                  >
                    <span className="stage-canvas-quick-panel__swatch-icon" aria-hidden="true">
                      <StudioIcon icon={StudioIcons.x} size={14} />
                    </span>
                    <span className="stage-canvas-quick-panel__swatch-label">Transparent</span>
                  </button>
                  {STAGE_BACKGROUND_SWATCHES.map((swatch) => (
                    <button
                      key={swatch}
                      type="button"
                      className={`stage-canvas-quick-panel__swatch ${canvas.backgroundColor.toLowerCase() === swatch.toLowerCase() ? 'is-active' : ''}`}
                      style={buildStageSwatchStyle(swatch)}
                      aria-label={`Use ${swatch}`}
                      onClick={() => documentActions.updateCanvasBackground(swatch)}
                    />
                  ))}
                </div>
                <label className="stage-canvas-quick-panel__field">
                  <span>Custom</span>
                  <input
                    type="color"
                    aria-label="Canvas background color"
                    value={canvas.backgroundColor === TRANSPARENT_CANVAS_BACKGROUND ? '#ffffff' : canvas.backgroundColor}
                    onChange={(event) => documentActions.updateCanvasBackground(event.target.value)}
                  />
                </label>
              </div>
            ) : null}
          </div>
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
        showWidgetBadges={showWidgetBadges}
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
        onToggleWidgetBadges={() => uiActions.setWidgetBadgesVisibility(!showWidgetBadges)}
        onToggleWireframe={() => uiActions.setEditModeWireframe(!editModeWireframe)}
        onSetBackdrop={(tone) => uiActions.setStageBackdrop(tone)}
        onZoomOut={() => uiActions.setZoom(Math.max(ZOOM_MIN, zoom - 0.1))}
        onZoomIn={() => uiActions.setZoom(Math.min(ZOOM_MAX, zoom + 0.1))}
        onFitToViewport={fitToViewport}
      />
    </div>
  );
}
