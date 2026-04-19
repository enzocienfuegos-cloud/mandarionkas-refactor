import { useState } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

function DropZoneRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const [isOver, setIsOver] = useState(false);
  const width = Math.max(20, Number(node.props.width ?? 120));
  const height = Math.max(20, Number(node.props.height ?? 120));
  const hitPadding = Math.max(0, Number(node.props.hitPadding ?? 16));
  const debugOutline = Boolean(node.props.debugOutline ?? true);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div
        onDragOver={(e) => { e.preventDefault(); setIsOver(true); }}
        onDragLeave={() => setIsOver(false)}
        onDrop={(e) => { e.preventDefault(); setIsOver(false); }}
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
