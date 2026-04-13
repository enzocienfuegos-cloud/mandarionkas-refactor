import { useCallback, useEffect, useRef, useState } from 'react';
import type { CanvasPoint } from './stage-geometry';
import { clampCanvasPoint, clientPointToCanvasPoint, isCanvasPointWithinBounds } from './stage-geometry';
import { applyEdgeAutoScroll } from './stage-viewport';
import type { WidgetLibraryDragPayload } from '../widget-library-drag';
import { readWidgetLibraryDragPayload } from '../widget-library-drag';
import type { AssetLibraryDragPayload } from '../asset-library-drag';
import { readAssetLibraryDragPayload } from '../asset-library-drag';

export type StageDropPreview = {
  payload: WidgetLibraryDragPayload | AssetLibraryDragPayload;
  point: CanvasPoint;
  clampedPoint: CanvasPoint;
  inBounds: boolean;
};

export function useStageDropController(args: {
  workspaceRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  zoom: number;
  canvas: { width: number; height: number };
  previewMode: boolean;
  onDropWidget: (preview: StageDropPreview) => void;
}) {
  const { workspaceRef, stageRef, zoom, canvas, previewMode, onDropWidget } = args;
  const [dropPreview, setDropPreview] = useState<StageDropPreview | null>(null);
  const clearTimerRef = useRef<number | null>(null);

  const clearScheduledPreview = useCallback(() => {
    if (clearTimerRef.current === null) return;
    window.clearTimeout(clearTimerRef.current);
    clearTimerRef.current = null;
  }, []);

  const clearDropPreview = useCallback(() => {
    clearScheduledPreview();
    setDropPreview(null);
  }, [clearScheduledPreview]);

  const scheduleDropPreviewClear = useCallback(() => {
    clearScheduledPreview();
    clearTimerRef.current = window.setTimeout(() => {
      clearTimerRef.current = null;
      setDropPreview(null);
    }, 24);
  }, [clearScheduledPreview]);

  useEffect(() => () => clearScheduledPreview(), [clearScheduledPreview]);

  useEffect(() => {
    if (!dropPreview) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      clearDropPreview();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [clearDropPreview, dropPreview]);

  const resolveDropPreview = useCallback((event: Pick<DragEvent, 'clientX' | 'clientY' | 'dataTransfer'>): StageDropPreview | null => {
    if (previewMode) return null;
    const payload = readWidgetLibraryDragPayload(event.dataTransfer) ?? readAssetLibraryDragPayload(event.dataTransfer);
    if (!payload) return null;
    applyEdgeAutoScroll({ workspace: workspaceRef.current, clientPoint: { clientX: event.clientX, clientY: event.clientY } });
    const point = clientPointToCanvasPoint({ clientX: event.clientX, clientY: event.clientY }, stageRef.current, zoom);
    if (!point) return null;
    return {
      payload,
      point,
      clampedPoint: clampCanvasPoint(point, canvas),
      inBounds: isCanvasPointWithinBounds(point, canvas),
    };
  }, [canvas, previewMode, stageRef, workspaceRef, zoom]);

  const handleStageDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const preview = resolveDropPreview(event.nativeEvent);
    if (!preview) return;
    event.preventDefault();
    clearScheduledPreview();
    if (event.dataTransfer) event.dataTransfer.dropEffect = preview.inBounds ? 'copy' : 'none';
    setDropPreview(preview);
  }, [clearScheduledPreview, resolveDropPreview]);

  const handleStageDragLeave = useCallback(() => {
    scheduleDropPreviewClear();
  }, [scheduleDropPreviewClear]);

  const handleStageDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    const preview = resolveDropPreview(event.nativeEvent);
    if (!preview) return;
    event.preventDefault();
    clearDropPreview();
    if (!preview.inBounds) return;
    onDropWidget(preview);
  }, [clearDropPreview, onDropWidget, resolveDropPreview]);

  return {
    dropPreview,
    clearDropPreview,
    handleStageDragOver,
    handleStageDragLeave,
    handleStageDrop,
  };
}
