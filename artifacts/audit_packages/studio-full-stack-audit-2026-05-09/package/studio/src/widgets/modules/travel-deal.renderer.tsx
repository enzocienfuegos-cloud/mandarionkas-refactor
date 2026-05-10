// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { TRAVEL_DEAL_DEFAULT_PROPS } from './travel-deal.shared';

const travelDealBrandPalette = {
  heroGradient: 'linear-gradient(135deg,#0f172a,#1d4ed8)',
} as const;

const travelDealHeroStyle: CSSProperties = {
  borderRadius: 12,
  padding: 12,
  background: travelDealBrandPalette.heroGradient,
  minHeight: 72,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
};

const travelDealDestinationStyle: CSSProperties = {
  fontSize: 18,
};

const travelDealMetaStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.82,
};

const travelDealFooterStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'end',
};

const travelDealFromLabelStyle: CSSProperties = {
  fontSize: 12,
  opacity: 0.72,
};

const travelDealPriceStyle: CSSProperties = {
  fontWeight: 900,
  fontSize: 24,
};

const travelDealCtaBaseStyle: CSSProperties = {
  borderRadius: 12,
  border: 'none',
  color: 'var(--neutral-slate-900)',
  fontWeight: 800,
  padding: '10px 12px',
  cursor: 'pointer',
};

function buildTravelDealCtaStyle(accent: string): CSSProperties {
  return {
    ...travelDealCtaBaseStyle,
    background: accent,
  };
}

function TravelDealModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={moduleBody}>
        <div style={travelDealHeroStyle}>
          <strong style={travelDealDestinationStyle}>{String(node.props.destination ?? TRAVEL_DEAL_DEFAULT_PROPS.destination)}</strong>
          <span style={travelDealMetaStyle}>
            {String(node.props.airline ?? TRAVEL_DEAL_DEFAULT_PROPS.airline)} · {String(node.props.nights ?? TRAVEL_DEAL_DEFAULT_PROPS.nights)}
          </span>
        </div>

        <div style={travelDealFooterStyle}>
          <div>
            <div style={travelDealFromLabelStyle}>From</div>
            <div style={travelDealPriceStyle}>{String(node.props.price ?? TRAVEL_DEAL_DEFAULT_PROPS.price)}</div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              ctx.triggerWidgetAction('click');
            }}
            style={buildTravelDealCtaStyle(accent)}
          >
            {String(node.props.ctaLabel ?? TRAVEL_DEAL_DEFAULT_PROPS.ctaLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function renderTravelDealStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <TravelDealModuleRenderer node={node} ctx={ctx} />;
}
