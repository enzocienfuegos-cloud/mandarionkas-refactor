export type DragPhase = 'idle' | 'dragging';

export type DragSourceConfig = {
  sourceWidgetId: string;
  tokenId: string;
  tokenLabel?: string;
  tokenImageUrl?: string;
  payload: { targetActionId?: string; targetSceneId?: string };
  dropTargetId?: string;
};

export type DragState = {
  source: DragSourceConfig;
  pointerId: number;
  startedAt: number;
  clientX: number;
  clientY: number;
  currentDropTargetId: string | null;
};

export type DragSubscriber = (state: DragState | null) => void;
