import { useMemo } from 'react';
import { shallowEqual, useStudioStore, useStudioStoreRef } from '../../core/store/use-studio-store';
import { useSceneActions, useTimelineActions, useUiActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { selectStageState } from '../../core/store/selectors/stage-selectors';
import { useStageMarqueeController } from './controllers/use-stage-marquee-controller';
import { useStageRuntimeController } from './controllers/use-stage-runtime-controller';
import { useStageSelectionController } from './controllers/use-stage-selection-controller';
import { useStageTransformController } from './controllers/use-stage-transform-controller';
import { useStageViewportController } from './controllers/use-stage-viewport-controller';
import { useStageDropController } from './controllers/use-stage-drop-controller';
import type { AssetLibraryDragPayload } from './asset-library-drag';
export type { ResizeHandle } from './stage-types';



function isCompatibleAssetTarget(widgetType: string | undefined, assetKind: AssetLibraryDragPayload['assetKind']): boolean {
  if (!widgetType) return false;
  if (assetKind === 'image') return widgetType === 'image' || widgetType === 'hero-image';
  if (assetKind === 'video') return widgetType === 'video-hero' || widgetType === 'interactive-video';
  return false;
}

function findAssetDropTarget(point: { x: number; y: number }, widgets: Array<{ id: string; type: string; frame: { x: number; y: number; width: number; height: number }; props: Record<string, unknown> }>, assetKind: AssetLibraryDragPayload['assetKind']) {
  for (let index = widgets.length - 1; index >= 0; index -= 1) {
    const widget = widgets[index];
    if (!isCompatibleAssetTarget(widget.type, assetKind)) continue;
    const { x, y, width, height } = widget.frame;
    if (point.x >= x && point.x <= x + width && point.y >= y && point.y <= y + height) return widget;
  }
  return undefined;
}

function resolveWidgetTypeForAsset(assetKind: AssetLibraryDragPayload['assetKind']) {
  if (assetKind === 'image') return 'image' as const;
  if (assetKind === 'video') return 'video-hero' as const;
  return null;
}

function buildAssetWidgetProps(payload: AssetLibraryDragPayload, currentProps?: Record<string, unknown>) {
  if (payload.assetKind === 'image') return { src: payload.assetSrc, assetId: payload.assetId, alt: payload.assetName };
  if (payload.assetKind === 'video') return { src: payload.assetSrc, assetId: payload.assetId, posterSrc: payload.assetPosterSrc ?? currentProps?.posterSrc };
  return null;
}

export function useStageController(workspaceRef: React.RefObject<HTMLDivElement>, stageRef: React.RefObject<HTMLDivElement>) {
  const sceneActions = useSceneActions();
  const timelineActions = useTimelineActions();
  const uiActions = useUiActions();
  const widgetActions = useWidgetActions();
  const stageState = useStudioStore(selectStageState, shallowEqual);
  const fullStateRef = useStudioStoreRef((value) => value);

  const { canvas, scene, widgets, widgetsById, zoom, playheadMs, isPlaying, previewMode } = stageState;

  const {
    fitToViewport,
    handleWorkspaceWheel,
    panModeActive,
    isPanning,
    handleWorkspacePointerDownCapture,
    handleWorkspacePointerMove,
    handleWorkspacePointerUp,
    handleWorkspacePointerCancel,
  } = useStageViewportController({
    workspaceRef,
    stageRef,
    canvas,
    zoom,
    setZoom: uiActions.setZoom,
  });

  const { interaction, beginWidgetDrag, beginWidgetResize } = useStageTransformController({
    workspaceRef,
    stageRef,
    zoom,
    previewMode,
    canvas,
    playheadMs,
    fullStateRef,
    widgetsById,
    selectWidget: widgetActions.selectWidget,
    updateWidgetFrames: widgetActions.updateWidgetFrames,
  });

  const { marquee, beginMarqueeSelection } = useStageMarqueeController({
    workspaceRef,
    stageRef,
    zoom,
    previewMode,
    widgets,
    playheadMs,
    selectWidget: widgetActions.selectWidget,
    selectWidgets: widgetActions.selectWidgets,
  });


  const { dropPreview, clearDropPreview, handleStageDragOver, handleStageDragLeave, handleStageDrop } = useStageDropController({
    workspaceRef,
    stageRef,
    zoom,
    canvas,
    previewMode,
    onDropWidget: (preview) => {
      if (preview.payload.kind === 'widget-library-item') {
        widgetActions.createWidget(preview.payload.widgetType, {
          x: preview.clampedPoint.x,
          y: preview.clampedPoint.y,
          anchor: 'center',
        });
        return;
      }
      const currentState = fullStateRef.current;
      const activeScene = currentState.document.scenes.find((item) => item.id === currentState.document.selection.activeSceneId) ?? currentState.document.scenes[0];
      const sceneWidgets = activeScene.widgetIds
        .map((id) => currentState.document.widgets[id])
        .filter(Boolean)
        .sort((a, b) => a.zIndex - b.zIndex);
      const targetWidget = findAssetDropTarget(preview.clampedPoint, sceneWidgets, preview.payload.assetKind);
      const props = buildAssetWidgetProps(preview.payload, targetWidget?.props);
      if (targetWidget && props) {
        widgetActions.updateWidgetProps(targetWidget.id, props);
        widgetActions.selectWidget(targetWidget.id);
        return;
      }
      const nextWidgetType = resolveWidgetTypeForAsset(preview.payload.assetKind);
      if (!nextWidgetType || !props) return;
      widgetActions.createWidget(nextWidgetType, {
        x: preview.clampedPoint.x,
        y: preview.clampedPoint.y,
        anchor: 'center',
      }, { props });
    },
  });

  const { sceneTransitionActive } = useStageRuntimeController({
    fullStateRef,
    scene,
    playheadMs,
    isPlaying,
    sceneActions: { selectScene: sceneActions.selectScene },
    timelineActions: { setPlayhead: timelineActions.setPlayhead, setPlaying: timelineActions.setPlaying },
    widgetActions: { executeAction: widgetActions.executeAction },
  });

  const { isWidgetVisible } = useStageSelectionController({
    widgetsById,
    playheadMs,
    interaction,
  });

  const liveFrameById = useMemo(() => interaction?.liveFrames ?? {}, [interaction]);
  const stageWidth = canvas.width * zoom;
  const stageHeight = canvas.height * zoom;

  return {
    stageState,
    fullStateRef,
    interaction,
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
    clearDropPreview,
    handleStageDragOver,
    handleStageDragLeave,
    handleStageDrop,
    isWidgetVisible,
    uiActions,
    sceneActions,
    widgetActions,
  };
}
