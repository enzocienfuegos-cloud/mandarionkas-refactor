import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { clampFloatingPanelPosition } from './components/stage-utils';
import { isStageToolbarDragHandleTarget } from './stage-interaction-targets';

type Viewport = { width: number; height: number };
type PanelBounds = { width: number; height: number };

export function useStageToolbarDrag(workspaceViewport: Viewport, toolbarBounds: PanelBounds) {
  const dragStateRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const [toolbarPosition, setToolbarPosition] = useState({ x: 0, y: 0 });

  const clampToolbarPosition = (x: number, y: number) => clampFloatingPanelPosition(
    { x, y },
    workspaceViewport,
    toolbarBounds,
  );

  useEffect(() => {
    const nextX = Math.max(32, Math.round(workspaceViewport.width / 2 - 240));
    const nextY = Math.max(24, workspaceViewport.height - 130);
    setToolbarPosition((current) => current.x === 0 && current.y === 0 ? { x: nextX, y: nextY } : current);
  }, [workspaceViewport.height, workspaceViewport.width]);

  useEffect(() => {
    setToolbarPosition((current) => {
      if (current.x === 0 && current.y === 0) return current;
      return clampToolbarPosition(current.x, current.y);
    });
  }, [toolbarBounds.height, toolbarBounds.width, workspaceViewport.height, workspaceViewport.width]);

  const beginToolbarDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    if (!isStageToolbarDragHandleTarget(target) || !event.isPrimary) return;
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
    setToolbarPosition(clampToolbarPosition(
      dragState.originX + (event.clientX - dragState.startX),
      dragState.originY + (event.clientY - dragState.startY),
    ));
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

  return {
    beginToolbarDrag,
    endToolbarDrag,
    onToolbarPointerMove,
    toolbarStyle,
  };
}
