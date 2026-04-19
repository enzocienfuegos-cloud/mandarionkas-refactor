import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

function parseActionMap(raw: unknown): Record<string, string> {
  try {
    const parsed = JSON.parse(String(raw ?? '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, string> : {};
  } catch {
    return {};
  }
}

function DropZoneRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }) {
  const [isOver, setIsOver] = useState(false);
  const width = Math.max(20, Number(node.props.width ?? 120));
  const height = Math.max(20, Number(node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);
  const matchActionMap = parseActionMap(node.props.matchActionMap);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsOver(true); }}
        onDragLeave={(e) => { e.stopPropagation(); setIsOver(false); }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOver(false);
          const tokenId = e.dataTransfer.getData('text/smx-token-id') || e.dataTransfer.getData('text/plain');
          const actionId = tokenId ? matchActionMap[tokenId] : undefined;
          if (actionId) {
            ctx.executeAction?.(actionId);
            return;
          }
          ctx.triggerWidgetAction('click');
        }}
        style={{
          width: width + hitPadding * 2,
          height: height + hitPadding * 2,
          borderRadius: '50%',
          border: debugOutline ? `2px dashed ${isOver ? '#00e5ff' : 'rgba(255,255,255,0.45)'}` : 'none',
          background: isOver ? 'rgba(0,229,255,0.12)' : 'transparent',
          transition: 'background-color 0.15s, border-color 0.15s',
        }}
      />
    </div>
  );
}

export function renderDropZoneStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <DropZoneRenderer node={node} ctx={ctx} />;
}
