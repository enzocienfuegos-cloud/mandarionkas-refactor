// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { usePlaybackDerivedValue } from '../../hooks/use-playback-engine';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded, StatChip } from './shared-styles';

const countdownBodyStyle: CSSProperties = {
  ...moduleBody,
  justifyContent: 'center',
};

const countdownGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(4,1fr)',
  gap: 8,
};

const countdownValueStyle: CSSProperties = {
  fontSize: 20,
  fontWeight: 800,
  textAlign: 'center',
};

const countdownLabelStyle: CSSProperties = {
  fontSize: 10,
  textAlign: 'center',
  opacity: 0.75,
};

function CountdownModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const totalSeconds = Number(node.props.totalSeconds ?? ((Number(node.props.days ?? 0) * 86400) + (Number(node.props.hours ?? 0) * 3600) + (Number(node.props.minutes ?? 0) * 60) + Number(node.props.seconds ?? 0)));
  const remaining = usePlaybackDerivedValue(ctx.playheadMs, (nextMs) => {
    const playheadMs = ctx.isReproducing ? nextMs : ctx.playheadMs;
    return Math.max(0, totalSeconds - Math.floor(playheadMs / 1000));
  });
  const days = Math.floor(remaining / 86400);
  const hours = Math.floor((remaining % 86400) / 3600);
  const minutes = Math.floor((remaining % 3600) / 60);
  const seconds = remaining % 60;

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={countdownBodyStyle}>
        <div style={countdownGridStyle}>
          {[['DD', days], ['HH', hours], ['MM', minutes], ['SS', seconds]].map(([label, value]) => (
            <StatChip key={String(label)} accent={accent}>
              <div style={countdownValueStyle}>{String(value).padStart(2, '0')}</div>
              <div style={countdownLabelStyle}>{String(label)}</div>
            </StatChip>
          ))}
        </div>
      </div>
    </div>
  );
}

export function renderCountdownStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <CountdownModuleRenderer node={node} ctx={ctx} />;
}
