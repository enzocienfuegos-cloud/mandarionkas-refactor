// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useState, type CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';
import { BUTTONS_DEFAULT_PROPS } from './buttons.shared';

const buttonsBodyStyle: CSSProperties = {
  ...moduleBody,
  justifyContent: 'center',
};

const buttonsRowBaseStyle: CSSProperties = {
  display: 'flex',
  gap: 8,
};

function buildButtonsRowStyle(vertical: boolean): CSSProperties {
  return {
    ...buttonsRowBaseStyle,
    flexDirection: vertical ? 'column' : 'row',
  };
}

function buildButtonsModuleButtonStyle(
  kind: 'primary' | 'secondary',
  accent: string,
  active: 'primary' | 'secondary' | null,
): CSSProperties {
  return {
    flex: 1,
    padding: '10px 12px',
    borderRadius: 12,
    textAlign: 'center',
    fontWeight: 800,
    cursor: 'pointer',
    border: kind === 'secondary' ? `1px solid ${accent}` : 'none',
    background: kind === 'primary' ? (active === kind ? 'var(--surface-card-light)' : accent) : (active === kind ? `${accent}22` : 'transparent'),
    color: kind === 'primary' ? 'var(--neutral-slate-900)' : 'var(--text-on-media-strong)',
  };
}

function ButtonsModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const accent = getAccent(node);
  const [active, setActive] = useState<'primary' | 'secondary' | null>(null);
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';

  return (
    <div style={moduleShell(node, ctx)}>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={buttonsBodyStyle}>
        <div style={buildButtonsRowStyle(vertical)}>
          <button
            type="button"
            style={buildButtonsModuleButtonStyle('primary', accent, active)}
            onClick={(e) => {
              e.stopPropagation();
              setActive('primary');
              ctx.triggerWidgetAction('click');
            }}
          >
            {String(node.props.primaryLabel ?? BUTTONS_DEFAULT_PROPS.primaryLabel)}
          </button>
          <button
            type="button"
            style={buildButtonsModuleButtonStyle('secondary', accent, active)}
            onClick={(e) => {
              e.stopPropagation();
              setActive('secondary');
              ctx.triggerWidgetAction('click');
            }}
          >
            {String(node.props.secondaryLabel ?? BUTTONS_DEFAULT_PROPS.secondaryLabel)}
          </button>
        </div>
      </div>
    </div>
  );
}

export function renderButtonsStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <ButtonsModuleRenderer node={node} ctx={ctx} />;
}
