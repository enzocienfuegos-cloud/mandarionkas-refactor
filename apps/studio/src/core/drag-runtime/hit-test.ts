type TargetEntry = {
  element: HTMLElement;
  hitPadding: number;
  cachedRect: DOMRect | null;
  resizeObserver: ResizeObserver | null;
};

export type HitTestRegistry = {
  register(targetId: string, element: HTMLElement, options: { hitPadding: number }): () => void;
  beginDrag(): void;
  hitTest(x: number, y: number): string | null;
  invalidate(): void;
};

export function createHitTestRegistry(): HitTestRegistry {
  const targets = new Map<string, TargetEntry>();
  let scrollListener: (() => void) | null = null;

  function invalidate(): void {
    for (const entry of targets.values()) {
      entry.cachedRect = null;
    }
  }

  function cleanupGlobalListeners(): void {
    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener, true);
      scrollListener = null;
    }
  }

  return {
    register(targetId: string, element: HTMLElement, options: { hitPadding: number }): () => void {
      const entry: TargetEntry = {
        element,
        hitPadding: options.hitPadding,
        cachedRect: null,
        resizeObserver: null,
      };
      targets.set(targetId, entry);

      return () => {
        const existing = targets.get(targetId);
        if (existing) {
          existing.resizeObserver?.disconnect();
          targets.delete(targetId);
        }
      };
    },

    beginDrag(): void {
      cleanupGlobalListeners();

      for (const entry of targets.values()) {
        entry.cachedRect = entry.element.getBoundingClientRect();

        if (!entry.resizeObserver) {
          entry.resizeObserver = new ResizeObserver(() => {
            entry.cachedRect = null;
          });
        }
        entry.resizeObserver.observe(entry.element);
      }

      scrollListener = () => invalidate();
      window.addEventListener('scroll', scrollListener, { passive: true, capture: true });
    },

    hitTest(x: number, y: number): string | null {
      for (const [targetId, entry] of targets) {
        const rect = entry.cachedRect;
        if (!rect) continue;
        const pad = entry.hitPadding;
        if (
          x >= rect.left - pad &&
          x <= rect.right + pad &&
          y >= rect.top - pad &&
          y <= rect.bottom + pad
        ) {
          return targetId;
        }
      }
      return null;
    },

    invalidate,
  };
}
