import { useEffect, useRef, useState } from 'react';
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
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tokens.map((token) => {
          const isDisabled = disabled.has(token.id);
          const isDragging = draggingId === token.id;
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
              style={{
                width: tokenSize,
                height: tokenSize,
                borderRadius: '50%',
                overflow: 'hidden',
                border: `2px solid ${token.accentColor ?? 'rgba(255,255,255,0.35)'}`,
                boxShadow: isDisabled ? 'none' : `0 0 14px ${token.accentColor ?? 'rgba(255,255,255,0.25)'}`,
                opacity: isDisabled ? 0.35 : 1,
                cursor: isDisabled ? 'not-allowed' : 'grab',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#1f2937',
                color: '#fff',
                fontSize: 11,
                fontWeight: 700,
                textAlign: 'center',
                padding: 6,
                userSelect: 'none',
                WebkitUserSelect: 'none',
                touchAction: 'none',
                pointerEvents: 'auto',
              }}
            >
              {token.src ? <img src={token.src} alt={token.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : token.label}
            </div>
          );
        })}
      </div>
      {draggingId && pointerPosition ? createPortal(
        <div
          style={{
            position: 'fixed',
            left: pointerPosition.x,
            top: pointerPosition.y,
            width: tokenSize,
            height: tokenSize,
            borderRadius: '50%',
            overflow: 'hidden',
            border: `2px solid ${tokens.find((token) => token.id === draggingId)?.accentColor ?? 'rgba(255,255,255,0.35)'}`,
            boxShadow: `0 14px 30px rgba(0,0,0,0.28), 0 0 18px ${tokens.find((token) => token.id === draggingId)?.accentColor ?? 'rgba(255,255,255,0.25)'}`,
            background: '#1f2937',
            color: '#fff',
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
          }}
        >
          {(() => {
            const token = tokens.find((item) => item.id === draggingId);
            if (!token) return null;
            return token.src
              ? <img src={token.src} alt={token.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
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
