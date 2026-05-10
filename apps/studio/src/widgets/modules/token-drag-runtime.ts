export type TokenDragPhase = 'start' | 'move' | 'end' | 'cancel';

export type TokenDragDetail = {
  phase: TokenDragPhase;
  tokenId: string;
  sourceWidgetId: string;
  clientX: number;
  clientY: number;
};

const TOKEN_DRAG_EVENT = 'smx:token-drag';

export function emitTokenDrag(detail: TokenDragDetail): void {
  window.dispatchEvent(new CustomEvent<TokenDragDetail>(TOKEN_DRAG_EVENT, { detail }));
}

export function subscribeTokenDrag(listener: (detail: TokenDragDetail) => void): () => void {
  const handler = (event: Event) => {
    const customEvent = event as CustomEvent<TokenDragDetail>;
    if (!customEvent.detail) return;
    listener(customEvent.detail);
  };
  window.addEventListener(TOKEN_DRAG_EVENT, handler as EventListener);
  return () => window.removeEventListener(TOKEN_DRAG_EVENT, handler as EventListener);
}
