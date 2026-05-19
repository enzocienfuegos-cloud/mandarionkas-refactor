type TargetEntry = {
  element: HTMLElement;
  hitPadding: number;
};

export type HitTestRegistry = {
  register(targetId: string, element: HTMLElement, options: { hitPadding: number }): () => void;
  beginDrag(): void;
  stopDrag(): void;
  hitTest(x: number, y: number): string | null;
};

export function createHitTestRegistry(): HitTestRegistry {
  const targets = new Map<string, TargetEntry>();

  return {
    register(targetId: string, element: HTMLElement, options: { hitPadding: number }): () => void {
      targets.set(targetId, { element, hitPadding: options.hitPadding });
      return () => {
        targets.delete(targetId);
      };
    },

    // Called at drag start — no caching, kept as a lifecycle hook for future extension.
    beginDrag(): void {},

    stopDrag(): void {},

    // Always reads live rects from the DOM so CSS transitions and GSAP transforms
    // never produce stale hit boxes (the caching approach broke during scene slide-ins).
    hitTest(x: number, y: number): string | null {
      for (const [targetId, entry] of targets) {
        const rect = entry.element.getBoundingClientRect();
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
  };
}
