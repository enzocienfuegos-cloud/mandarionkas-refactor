import { useEffect, useLayoutEffect, useRef } from 'react';
import { attachScratch, type ScratchCoverDescriptor, type ScratchEngineHandle, type ScratchPaintArgs } from '@smx/scratch-engine';

type ScratchSurfaceProps = {
  threshold: number;
  brushSize: number;
  activationDelayMs?: number;
  fadeOutMs?: number;
  autoRemove?: boolean;
  cover?: ScratchCoverDescriptor;
  coverKey?: string;
  resetKey?: string | number;
  paintCover?: (args: ScratchPaintArgs) => boolean | void | Promise<boolean | void>;
  onReveal?: (cleared: number) => void;
  className?: string;
  style?: React.CSSProperties;
};

export function ScratchSurface({
  threshold,
  brushSize,
  activationDelayMs = 0,
  fadeOutMs = 120,
  autoRemove = true,
  cover,
  coverKey = '',
  resetKey = '',
  paintCover,
  onReveal,
  className,
  style,
}: ScratchSurfaceProps): JSX.Element {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const revealRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hitAreaRef = useRef<HTMLDivElement | null>(null);
  const handleRef = useRef<ScratchEngineHandle | null>(null);
  const didMountRef = useRef(false);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const coverElement = coverRef.current;
    const revealElement = revealRef.current;
    const canvas = canvasRef.current;
    const hitArea = hitAreaRef.current;
    if (!root || !coverElement || !revealElement || !canvas || !hitArea) return undefined;

    const handle = attachScratch({
      root,
      coverElement,
      revealElement,
      canvas,
      hitArea,
      threshold,
      brushSize,
      cover,
      paintCover,
      activationDelayMs,
      fadeOutMs,
      autoRemove,
      onReveal,
    });
    handleRef.current = handle;
    return () => {
      handle.destroy();
      handleRef.current = null;
      didMountRef.current = false;
    };
  }, [activationDelayMs, autoRemove, brushSize, cover, coverKey, fadeOutMs, onReveal, paintCover, threshold]);

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }
    handleRef.current?.reset();
  }, [resetKey]);

  return (
    <div ref={rootRef} className={className} data-scratch style={style}>
      <div
        ref={revealRef}
        aria-hidden="true"
        data-scratch-reveal
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      />
      <div
        ref={coverRef}
        aria-hidden="true"
        data-scratch-cover
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <canvas ref={canvasRef} data-scratch-canvas />
      </div>
      <div ref={hitAreaRef} data-scratch-hit-area data-scratch-completed="false" />
    </div>
  );
}
