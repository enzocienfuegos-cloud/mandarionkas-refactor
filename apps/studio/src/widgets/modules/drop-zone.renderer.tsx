import { useEffect, useRef, useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';
import { subscribeTokenDrag } from './token-drag-runtime';

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
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const width = Math.max(20, Number(node.props.width ?? 120));
  const height = Math.max(20, Number(node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);
  const matchActionMap = parseActionMap(node.props.matchActionMap);

  useEffect(() => {
    return subscribeTokenDrag((detail) => {
      const element = zoneRef.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const inside = detail.clientX >= rect.left && detail.clientX <= rect.right && detail.clientY >= rect.top && detail.clientY <= rect.bottom;

      if (detail.phase === 'start' || detail.phase === 'move') {
        setIsOver(inside);
        return;
      }

      if ((detail.phase === 'end' || detail.phase === 'cancel') && inside) {
        const actionId = matchActionMap[detail.tokenId];
        if (actionId) {
          ctx.executeAction?.(actionId);
        } else {
          ctx.triggerWidgetAction('click');
        }
      }
      setIsOver(false);
    });
  }, [ctx, matchActionMap]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        ref={zoneRef}
        onPointerDown={(event) => {
          event.stopPropagation();
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
