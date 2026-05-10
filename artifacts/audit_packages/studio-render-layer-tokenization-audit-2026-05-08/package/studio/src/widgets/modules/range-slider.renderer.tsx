import { useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

const rangeSliderBodyStyle: CSSProperties = {
  ...moduleBody,
  justifyContent: 'center',
};

const rangeSliderValueStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 700,
};

function buildRangeSliderInputStyle(accent: string): CSSProperties {
  return {
    accentColor: accent,
  };
}

function RangeSliderModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const [value, setValue] = useState(Number(node.props.value ?? 50));

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={rangeSliderBodyStyle}>
        <input
          type="range"
          min={Number(node.props.min ?? 0)}
          max={Number(node.props.max ?? 100)}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          onPointerDown={(e) => e.stopPropagation()}
          style={buildRangeSliderInputStyle(accent)}
        />
        <div style={rangeSliderValueStyle}>Range: {value}{String(node.props.units ?? '')}</div>
      </div>
    </div>
  );
}

export function renderRangeSliderStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <RangeSliderModuleRenderer node={node} ctx={ctx} />;
}
