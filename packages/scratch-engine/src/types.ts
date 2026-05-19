export type ScratchPoint = { x: number; y: number };

export type ScratchProgress = {
  cleared: number;
  thresholdReached: boolean;
};

export type ScratchMilestone = {
  id: string;
  at: number;
};

export type ScratchCoverDescriptor =
  | { kind: 'color'; value: string }
  | { kind: 'image'; src: string; fit?: 'cover' | 'contain' | 'fill' }
  | { kind: 'snapshot'; el: HTMLElement };

export type ScratchPaintArgs = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
  cover?: ScratchCoverDescriptor;
};

export type ScratchEngineConfig = {
  root: HTMLElement;
  threshold?: number;
  brushSize?: number;
  cover?: ScratchCoverDescriptor;
  milestones?: ScratchMilestone[];
  autoRemove?: boolean;
  fadeOutMs?: number;
  activationDelayMs?: number;
  coverElement?: HTMLElement | null;
  revealElement?: HTMLElement | null;
  canvas?: HTMLCanvasElement | null;
  hitArea?: HTMLElement | null;
  paintCover?: (args: ScratchPaintArgs) => boolean | void | Promise<boolean | void>;
  onProgress?: (progress: ScratchProgress) => void;
  onReveal?: (finalCleared: number) => void;
  onMilestone?: (id: string, cleared: number) => void;
};

export type ScratchEngineHandle = {
  destroy(): void;
  reset(): void;
  revealNow(): void;
  getCleared(): number;
  isActive(): boolean;
};
