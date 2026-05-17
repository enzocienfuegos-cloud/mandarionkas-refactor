// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { emitTokenDrag } from './token-drag-runtime';
import { tokenShapeToBorderRadius, type DragTokenItem, type TokenShape } from './drag-token-pool.types';

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
  position: 'relative',
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
  radius: string,
): CSSProperties {
  return {
    ...dragTokenBaseStyle,
    borderRadius: radius,
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
  radius: string,
): CSSProperties {
  return {
    ...dragTokenGhostBaseStyle,
    borderRadius: radius,
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
  const tokens: DragTokenItem[] = Array.isArray(node.props.tokens) ? node.props.tokens as DragTokenItem[] : [];
  const tokenSize = Math.max(32, Number(node.props.tokenSize ?? 72));
  const gap = Math.max(4, Number(node.props.gap ?? 16));
  const disabled = new Set(Array.isArray(node.props.disabledIds) ? node.props.disabledIds.map((value) => String(value)) : []);
  const tokenShape: TokenShape = node.props.tokenShape === 'square' || node.props.tokenShape === 'rounded' || node.props.tokenShape === 'circle'
    ? node.props.tokenShape
    : 'circle';
  const radius = tokenShapeToBorderRadius(tokenShape);

  useEffect(() => {
    if (!draggingId) return undefined;
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
              style={buildDragTokenStyle(tokenSize, token.accentColor, isDisabled, radius)}
            >
              {token.baseImageUrl ? (
                <img
                  src={token.baseImageUrl}
                  alt=""
                  aria-hidden="true"
                  draggable={false}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', zIndex: 0, pointerEvents: 'none' }}
                />
              ) : null}
              <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                {token.imageUrl ? <img src={token.imageUrl} alt={token.label} draggable={false} style={dragTokenImageStyle} /> : token.label}
              </span>
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
            radius,
          )}
        >
          {(() => {
            const token = tokens.find((item) => item.id === draggingId);
            if (!token) return null;
            return (
              <>
                {token.baseImageUrl ? (
                  <img
                    src={token.baseImageUrl}
                    alt=""
                    aria-hidden="true"
                    draggable={false}
                    style={{ ...dragTokenGhostImageStyle, position: 'absolute', inset: 0, zIndex: 0 }}
                  />
                ) : null}
                <span style={{ position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                  {token.imageUrl ? <img src={token.imageUrl} alt={token.label} draggable={false} style={dragTokenGhostImageStyle} /> : token.label}
                </span>
              </>
            );
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
