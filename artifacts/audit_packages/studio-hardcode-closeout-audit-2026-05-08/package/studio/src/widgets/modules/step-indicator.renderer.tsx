import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { renderCollapsedIfNeeded } from './shared-styles';

const stepIndicatorShellStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

const stepIndicatorTrackBaseStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
};

function buildStepIndicatorTrackStyle(gap: number): CSSProperties {
  return {
    ...stepIndicatorTrackBaseStyle,
    gap,
  };
}

function buildStepIndicatorDotStyle(size: number, active: boolean, doneColor: string, pendingColor: string): CSSProperties {
  return {
    width: size,
    height: size,
    borderRadius: '50%',
    background: active ? doneColor : pendingColor,
    boxShadow: active ? `0 0 12px ${doneColor}` : 'none',
  };
}

function StepIndicatorRenderer({ node }: { node: WidgetNode; ctx: RenderContext }) {
  const total = Math.max(1, Number(node.props.total ?? 3));
  const current = Math.max(0, Math.min(total, Number(node.props.current ?? 1)));
  const size = Math.max(4, Number(node.props.size ?? 10));
  const gap = Math.max(2, Number(node.props.gap ?? 10));
  const doneColor = String(node.props.doneColor ?? '#ffffff');
  const pendingColor = String(node.props.pendingColor ?? 'rgba(255,255,255,0.3)');

  return (
    <div style={stepIndicatorShellStyle}>
      <div style={buildStepIndicatorTrackStyle(gap)}>
        {Array.from({ length: total }, (_, index) => (
          <div key={index} style={buildStepIndicatorDotStyle(size, index < current, doneColor, pendingColor)} />
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
