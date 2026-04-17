import { useCallback, useEffect, useRef, useState } from 'react';
import { getCursorAnchoredScrollDelta, getNextZoomFromWheel, ZOOM_MIN } from './stage-viewport';

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
    if (target?.closest('.workspace-toolbar')) return;
    if (!target?.closest('.stage-size-shell') && !target?.closest('.stage-surface')) return;
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
    if (!panModeActive) return;
    if (event.button !== 0 && event.button !== 1) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.workspace-toolbar')) return;
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
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [panModeActive, workspaceRef]);

  const handleWorkspacePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    const workspace = workspaceRef.current;
    if (!workspace) return;
    event.preventDefault();
    workspace.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    workspace.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  }, [workspaceRef]);

  const finishWorkspacePan = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const panState = panStateRef.current;
    if (!panState || panState.pointerId !== event.pointerId) return;
    panStateRef.current = null;
    setIsPanning(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, []);

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
  }, []);

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
