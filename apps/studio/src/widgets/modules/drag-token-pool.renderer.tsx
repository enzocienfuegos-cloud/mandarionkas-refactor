// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { emitTokenDrag } from './token-drag-runtime';

type TokenItem = {
  id: string;
  label: string;
  src?: string;
  accentColor?: string;
};

function parseTokens(raw: unknown): TokenItem[] {
  if (Array.isArray(raw)) return raw as TokenItem[];
  try {
    const parsed = JSON.parse(String(raw ?? '[]'));
    return Array.isArray(parsed) ? parsed as TokenItem[] : [];
  } catch {
    return [];
  }
}

const dragTokenPoolShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const dragTokenPoolTrackBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  flexWrap: 'wrap',
  justifyContent: 'center',
};

const dragTokenBaseStyle: CSSProperties = {
  borderRadius: '50%',
  overflow: 'hidden',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--neutral-slate-800)',
  color: 'var(--surface-card-light)',
  fontSize: 11,
  fontWeight: 700,
  textAlign: 'center',
  padding: 6,
  userSelect: 'none',
  WebkitUserSelect: 'none',
  touchAction: 'none',
  pointerEvents: 'auto',
};

const dragTokenImageStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  objectFit: 'cover',
};

const dragTokenGhostImageStyle: CSSProperties = {
  ...dragTokenImageStyle,
  pointerEvents: 'none',
};

const dragTokenGhostBaseStyle: CSSProperties = {
  position: 'fixed',
  borderRadius: '50%',
  overflow: 'hidden',
  background: 'var(--neutral-slate-800)',
  color: 'var(--surface-card-light)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
  padding: 6,
  fontSize: 11,
  fontWeight: 700,
  transform: 'translate(-50%, -50%) scale(1.06)',
  pointerEvents: 'none',
  zIndex: 9999,
};

function buildDragTokenTrackStyle(gap: number): CSSProperties {
  return {
    ...dragTokenPoolTrackBaseStyle,
    gap,
  };
}

function buildDragTokenStyle(
  tokenSize: number,
  accentColor: string | undefined,
  isDisabled: boolean,
): CSSProperties {
  return {
    ...dragTokenBaseStyle,
    width: tokenSize,
    height: tokenSize,
    border: `2px solid ${accentColor ?? 'var(--white-a-35)'}`,
    boxShadow: isDisabled ? 'none' : `0 0 14px ${accentColor ?? 'var(--white-a-24)'}`,
    opacity: isDisabled ? 0.35 : 1,
    cursor: isDisabled ? 'not-allowed' : 'grab',
  };
}

function buildDragTokenGhostStyle(
  pointerPosition: { x: number; y: number },
  tokenSize: number,
  accentColor: string | undefined,
): CSSProperties {
  return {
    ...dragTokenGhostBaseStyle,
    left: pointerPosition.x,
    top: pointerPosition.y,
    width: tokenSize,
    height: tokenSize,
    border: `2px solid ${accentColor ?? 'var(--white-a-35)'}`,
    boxShadow: `0 14px 30px hsl(0 0% 0% / 0.28), 0 0 18px ${accentColor ?? 'var(--white-a-24)'}`,
  };
}

function DragTokenPoolRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pointerPosition, setPointerPosition] = useState<{ x: number; y: number } | null>(null);
  const pointerStateRef = useRef<{ pointerId: number; tokenId: string } | null>(null);
  const tokens = parseTokens(node.props.tokens);
  const tokenSize = Math.max(32, Number(node.props.tokenSize ?? 72));
  const gap = Math.max(4, Number(node.props.gap ?? 16));
  const disabled = new Set(String(node.props.disabledIds ?? '').split(',').map((value) => value.trim()).filter(Boolean));

  useEffect(() => {
    if (!draggingId) return;
    const handlePointerMove = (event: PointerEvent) => {
      const current = pointerStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      setPointerPosition({ x: event.clientX, y: event.clientY });
      emitTokenDrag({
        phase: 'move',
        tokenId: current.tokenId,
        sourceWidgetId: node.id,
        clientX: event.clientX,
        clientY: event.clientY,
      });
    };
    const finishDrag = (event: PointerEvent, phase: 'end' | 'cancel') => {
      const current = pointerStateRef.current;
      if (!current || event.pointerId !== current.pointerId) return;
      emitTokenDrag({
        phase,
        tokenId: current.tokenId,
        sourceWidgetId: node.id,
        clientX: event.clientX,
        clientY: event.clientY,
      });
      pointerStateRef.current = null;
      setDraggingId(null);
      setPointerPosition(null);
    };
    const handlePointerUp = (event: PointerEvent) => finishDrag(event, 'end');
    const handlePointerCancel = (event: PointerEvent) => finishDrag(event, 'cancel');

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [draggingId, node.id]);

  return (
    <div style={dragTokenPoolShellStyle}>
      <div style={buildDragTokenTrackStyle(gap)}>
        {tokens.map((token) => {
          const isDisabled = disabled.has(token.id);
          return (
            <div
              key={token.id}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (isDisabled) return;
                pointerStateRef.current = { pointerId: event.pointerId, tokenId: token.id };
                setDraggingId(token.id);
                setPointerPosition({ x: event.clientX, y: event.clientY });
                emitTokenDrag({
                  phase: 'start',
                  tokenId: token.id,
                  sourceWidgetId: node.id,
                  clientX: event.clientX,
                  clientY: event.clientY,
                });
              }}
              style={buildDragTokenStyle(tokenSize, token.accentColor, isDisabled)}
            >
              {token.src ? <img src={token.src} alt={token.label} draggable={false} style={dragTokenImageStyle} /> : token.label}
            </div>
          );
        })}
      </div>
      {draggingId && pointerPosition ? createPortal(
        <div
          style={buildDragTokenGhostStyle(
            pointerPosition,
            tokenSize,
            tokens.find((token) => token.id === draggingId)?.accentColor,
          )}
        >
          {(() => {
            const token = tokens.find((item) => item.id === draggingId);
            if (!token) return null;
            return token.src
              ? <img src={token.src} alt={token.label} draggable={false} style={dragTokenGhostImageStyle} />
              : token.label;
          })()}
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

export function renderDragTokenPoolStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DragTokenPoolRenderer node={node} ctx={ctx} />;
}
