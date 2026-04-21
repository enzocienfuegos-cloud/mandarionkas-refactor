import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

function StepIndicatorRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const total = Math.max(1, Number(node.props.total ?? 3));
  const current = Math.max(0, Math.min(total, Number(node.props.current ?? 1)));
  const size = Math.max(4, Number(node.props.size ?? 10));
  const gap = Math.max(2, Number(node.props.gap ?? 10));
  const doneColor = String(node.props.doneColor ?? '#ffffff');
  const pendingColor = String(node.props.pendingColor ?? 'rgba(255,255,255,0.3)');

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap, alignItems: 'center' }}>
        {Array.from({ length: total }, (_, index) => (
          <div
            key={index}
            style={{
              width: size,
              height: size,
              borderRadius: '50%',
              background: index < current ? doneColor : pendingColor,
              boxShadow: index < current ? `0 0 12px ${doneColor}` : 'none',
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function renderStepIndicatorStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <StepIndicatorRenderer node={node} ctx={ctx} />;
}
