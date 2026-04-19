import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

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
  const tokens = parseTokens(node.props.tokens);
  const tokenSize = Math.max(32, Number(node.props.tokenSize ?? 72));
  const gap = Math.max(4, Number(node.props.gap ?? 16));
  const disabled = new Set(String(node.props.disabledIds ?? '').split(',').map((value) => value.trim()).filter(Boolean));

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {tokens.map((token) => {
          const isDisabled = disabled.has(token.id);
          const isDragging = draggingId === token.id;
          return (
            <div
              key={token.id}
              draggable={!isDisabled}
              onDragStart={() => setDraggingId(token.id)}
              onDragEnd={() => setDraggingId(null)}
              style={{
                width: tokenSize,
                height: tokenSize,
                borderRadius: '50%',
                overflow: 'hidden',
                border: `2px solid ${token.accentColor ?? 'rgba(255,255,255,0.35)'}`,
                boxShadow: isDisabled ? 'none' : `0 0 14px ${token.accentColor ?? 'rgba(255,255,255,0.25)'}`,
                opacity: isDisabled ? 0.35 : isDragging ? 0.55 : 1,
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
              }}
            >
              {token.src ? <img src={token.src} alt={token.label} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : token.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function renderDragTokenPoolStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DragTokenPoolRenderer node={node} ctx={ctx} />;
}
