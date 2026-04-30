import { useCallback, useEffect, useRef, useState } from 'react';
import { clampZoom, getCursorAnchoredScrollDelta, getNextZoomFromWheel, ZOOM_MIN } from './stage-viewport';
import { isWithinStageSurfaceTarget, isWithinStageToolbarTarget } from '../stage-interaction-targets';

function isEditableTarget(target: EventTarget | null): boolean {
  const node = target as HTMLElement | null;
  const tagName = node?.tagName?.toLowerCase();
  return Boolean(node?.isContentEditable) || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

export function useStageViewportController(args: {
  workspaceRef: React.RefObject<HTMLDivElement>;
  stageRef: React.RefObject<HTMLDivElement>;
  canvas: { width: number; height: number };
  zoom: number;
  setZoom: (zoom: number) => void;
}) {
  const { workspaceRef, stageRef, canvas, zoom, setZoom } = args;
  const [panModeActive, setPanModeActive] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{ pointerId: number; startX: number; startY: number; scrollLeft: number; scrollTop: number } | null>(null);
  const activeTouchPointsRef = useRef<Map<number, { clientX: number; clientY: number }>>(new Map());
  const pinchStateRef = useRef<{
    pointerIds: [number, number];
    startDistance: number;
    startZoom: number;
    startScrollLeft: number;
    startScrollTop: number;
    beforeRect: DOMRect;
  } | null>(null);

  const clearPinchState = useCallback(() => {
    pinchStateRef.current = null;
  }, []);

  const beginPinchIfNeeded = useCallback(() => {
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    const entries = Array.from(activeTouchPointsRef.current.entries());
    if (!workspace || !stage || entries.length < 2) return;
    const [[idA, pointA], [idB, pointB]] = entries;
    const startDistance = Math.hypot(pointB.clientX - pointA.clientX, pointB.clientY - pointA.clientY);
    if (!Number.isFinite(startDistance) || startDistance < 12) return;
    pinchStateRef.current = {
      pointerIds: [idA, idB],
      startDistance,
      startZoom: zoom,
      startScrollLeft: workspace.scrollLeft,
      startScrollTop: workspace.scrollTop,
      beforeRect: stage.getBoundingClientRect(),
    };
  }, [stageRef, workspaceRef, zoom]);

  const fitToViewport = useCallback(() => {
    const node = workspaceRef.current;
    if (!node) return;
    const bounds = node.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    const fitZoom = Math.min(
      Math.max(1, bounds.width - 96) / canvas.width,
      Math.max(1, bounds.height - 96) / canvas.height,
      1,
    );
    setZoom(Math.max(ZOOM_MIN, fitZoom));
  }, [canvas.height, canvas.width, setZoom, workspaceRef]);

  const handleWorkspaceWheel = useCallback((event: WheelEvent) => {
    const target = event.target as HTMLElement | null;
    if (isWithinStageToolbarTarget(target)) return;
    if (!isWithinStageSurfaceTarget(target) && !target?.closest('.stage-size-shell')) return;
    const workspace = workspaceRef.current;
    const stage = stageRef.current;
    if (!workspace || !stage) return;
    const nextZoom = getNextZoomFromWheel(zoom, event.deltaY, event.deltaMode);
    if (nextZoom === zoom) return;
    event.preventDefault();
    const beforeRect = stage.getBoundingClientRect();
    const clientPoint = { clientX: event.clientX, clientY: event.clientY };
    setZoom(nextZoom);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const workspaceNode = workspaceRef.current;
        const stageNode = stageRef.current;
        if (!workspaceNode || !stageNode) return;
        const afterRect = stageNode.getBoundingClientRect();
        const delta = getCursorAnchoredScrollDelta({
          clientPoint,
          beforeRect,
          afterRect,
          beforeZoom: zoom,
          afterZoom: nextZoom,
        });
        workspaceNode.scrollLeft += delta.x;
        workspaceNode.scrollTop += delta.y;
      });
    });
  }, [setZoom, stageRef, workspaceRef, zoom]);

  const handleWorkspacePointerDownCapture = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      if (activeTouchPointsRef.current.size >= 2) {
        beginPinchIfNeeded();
        event.preventDefault();
        event.stopPropagation();
        return;
      }
    }
    if (!panModeActive) return;
    if (!event.isPrimary) return;
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    if (isWithinStageToolbarTarget(target)) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    panStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: workspace.scrollLeft,
      scrollTop: workspace.scrollTop,
    };
    setIsPanning(true);
    event.preventDefault();
    event.stopPropagation();
    if (event.currentTarget.setPointerCapture) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  }, [beginPinchIfNeeded, panModeActive, workspaceRef]);

  const handleWorkspacePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch' && activeTouchPointsRef.current.has(event.pointerId)) {
      activeTouchPointsRef.current.set(event.pointerId, { clientX: event.clientX, clientY: event.clientY });
      const pinchState = pinchStateRef.current;
      if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
        const [idA, idB] = pinchState.pointerIds;
        const pointA = activeTouchPointsRef.current.get(idA);
        const pointB = activeTouchPointsRef.current.get(idB);
        const workspace = workspaceRef.current;
        const stage = stageRef.current;
        if (!pointA || !pointB || !workspace || !stage) return;
        const nextDistance = Math.hypot(pointB.clientX - pointA.clientX, pointB.clientY - pointA.clientY);
        if (!Number.isFinite(nextDistance) || nextDistance < 12) return;
        const center = {
          clientX: (pointA.clientX + pointB.clientX) / 2,
          clientY: (pointA.clientY + pointB.clientY) / 2,
        };
        const nextZoom = clampZoom(pinchState.startZoom * (nextDistance / pinchState.startDistance));
        event.preventDefault();
        setZoom(nextZoom);
        requestAnimationFrame(() => {
          const workspaceNode = workspaceRef.current;
          const stageNode = stageRef.current;
          if (!workspaceNode || !stageNode) return;
          const afterRect = stageNode.getBoundingClientRect();
          const delta = getCursorAnchoredScrollDelta({
            clientPoint: center,
            beforeRect: pinchState.beforeRect,
            afterRect,
            beforeZoom: pinchState.startZoom,
            afterZoom: nextZoom,
          });
          workspaceNode.scrollLeft = pinchState.startScrollLeft + delta.x;
          workspaceNode.scrollTop = pinchState.startScrollTop + delta.y;
        });
        return;
      }
    }
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    event.preventDefault();
    workspace.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    workspace.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  }, [workspaceRef]);

  const finishWorkspacePan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    activeTouchPointsRef.current.delete(event.pointerId);
    const pinchState = pinchStateRef.current;
    if (pinchState && pinchState.pointerIds.includes(event.pointerId)) {
      clearPinchState();
      event.preventDefault();
      return;
    }
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, [clearPinchState]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== 'Space' || isEditableTarget(event.target)) return;
      setPanModeActive(true);
      event.preventDefault();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space') return;
      setPanModeActive(false);
    };

    const handleWindowBlur = () => {
      setPanModeActive(false);
      panStateRef.current = null;
      activeTouchPointsRef.current.clear();
      clearPinchState();
      setIsPanning(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [clearPinchState]);

  useEffect(() => { fitToViewport(); }, [fitToViewport]);

  return {
    fitToViewport,
    handleWorkspaceWheel,
    panModeActive,
    isPanning,
    handleWorkspacePointerDownCapture,
    handleWorkspacePointerMove,
    handleWorkspacePointerUp: finishWorkspacePan,
    handleWorkspacePointerCancel: finishWorkspacePan,
  };
}
