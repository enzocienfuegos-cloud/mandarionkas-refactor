import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { DragStore } from './drag-store';
import type { DragState } from './types';

const ghostBaseStyle: CSSProperties = {
  position: 'fixed',
  left: 0,
  top: 0,
  pointerEvents: 'none',
  zIndex: 9999,
  willChange: 'transform',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 6,
  fontSize: 11,
  fontWeight: 700,
  color: 'var(--surface-card-light)',
  background: 'transparent',
  backfaceVisibility: 'hidden',
  transformStyle: 'preserve-3d',
};

type Props = { store: DragStore };

export function DragGhostLayer({ store }: Props): JSX.Element | null {
  const [state, setState] = useState<DragState | null>(store.getState());
  const ghostRef = useRef<HTMLDivElement | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const pendingPosRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const unsubscribe = store.subscribe((next) => {
      setState(next);
      if (next && ghostRef.current) {
        pendingPosRef.current = { x: next.clientX, y: next.clientY };
        if (rafIdRef.current === null) {
          rafIdRef.current = window.requestAnimationFrame(() => {
            rafIdRef.current = null;
            const pos = pendingPosRef.current;
            const ghost = ghostRef.current;
            if (!pos || !ghost) return;
            ghost.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(1.06)`;
          });
        }
      }
    });
    return () => {
      unsubscribe();
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [store]);

  if (!state) return null;

  const { source } = state;

  const ghostCallbackRef = (el: HTMLDivElement | null) => {
    ghostRef.current = el;
    if (el) {
      el.style.transform = `translate3d(${state.clientX}px, ${state.clientY}px, 0) translate(-50%, -50%) scale(1.06)`;
    }
  };

  return (
    <div
      ref={ghostCallbackRef}
      style={{
        ...ghostBaseStyle,
        width: 72,
        height: 72,
        borderRadius: '50%',
        border: '2px solid var(--white-a-35)',
        boxShadow: '0 14px 30px hsl(0 0% 0% / 0.28), 0 0 18px var(--white-a-24)',
        overflow: 'hidden',
      }}
    >
      <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
        {source.tokenImageUrl ? (
          <img
            src={source.tokenImageUrl}
            alt={source.tokenLabel ?? ''}
            decoding="async"
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
          />
        ) : (source.tokenLabel ?? '')}
      </span>
    </div>
  );
}
