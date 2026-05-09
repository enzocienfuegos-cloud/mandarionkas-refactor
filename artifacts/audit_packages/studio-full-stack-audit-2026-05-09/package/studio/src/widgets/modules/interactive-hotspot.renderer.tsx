// render-tokenized: brand/theme split enforced by lint-color-literals.mjs
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, renderCollapsedIfNeeded } from './shared-styles';
import { ModuleHotspotIcon } from './render-icons';

const hotspotShellBaseStyle: CSSProperties = {
  width: '100%',
  height: '100%',
  position: 'relative',
  background: 'transparent',
  overflow: 'visible',
};

const hotspotButtonBaseStyle: CSSProperties = {
  position: 'absolute',
  height: 30,
  minHeight: 30,
  maxHeight: 30,
  blockSize: '30px',
  minBlockSize: '30px',
  maxBlockSize: '30px',
  border: 'none',
  color: 'var(--neutral-slate-900)',
  fontWeight: 900,
  fontSize: 15,
  lineHeight: 1,
  padding: 0,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
  aspectRatio: '1 / 1',
  flexShrink: 0,
  boxSizing: 'border-box',
  overflow: 'hidden',
  appearance: 'none',
  WebkitAppearance: 'none',
};

const hotspotIconWrapBaseStyle: CSSProperties = {
  display: 'inline-flex',
};

const hotspotCardBaseStyle: CSSProperties = {
  position: 'absolute',
  left: 12,
  right: 12,
  bottom: 12,
  borderRadius: 14,
  background: 'var(--surface-tooltip)',
  padding: '10px 12px',
  display: 'grid',
  gap: 6,
  border: 'none',
  textAlign: 'left',
  cursor: 'pointer',
};

const hotspotCardHeaderBaseStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '.06em',
};

const hotspotCardBodyStyle: CSSProperties = {
  fontSize: 12,
  lineHeight: 1.45,
};

const hotspotLabelStyle: CSSProperties = {
  position: 'absolute',
  left: 12,
  bottom: 12,
  fontSize: 12,
  fontWeight: 700,
};

function hotspotShapeStyle(shape: string): CSSProperties {
  if (shape === 'square') return { borderRadius: 12 };
  if (shape === 'pill') return { borderRadius: 999, width: 44, minWidth: 44 };
  if (shape === 'diamond') return { borderRadius: 10 };
  return { borderRadius: 999, clipPath: 'circle(50% at 50% 50%)' };
}

function hotspotAnimation(effect: string, accent: string, baseTransform: string): CSSProperties {
  if (effect === 'bounce') return { animation: 'smxHotspotBounce 1.2s ease-in-out infinite' };
  if (effect === 'ping') return { boxShadow: `0 0 0 0 ${accent}55`, animation: 'smxHotspotPing 1.8s ease-out infinite' };
  if (effect === 'pulse') return { boxShadow: `0 0 0 6px ${accent}33, 0 0 0 18px ${accent}11`, animation: 'smxHotspotPulse 1.8s ease-in-out infinite', transform: baseTransform };
  return { transform: baseTransform };
}

function buildHotspotShellStyle(color: string): CSSProperties {
  return {
    ...hotspotShellBaseStyle,
    color,
  };
}

function buildHotspotButtonStyle(
  hotspotX: number,
  hotspotY: number,
  shape: string,
  effect: string,
  accent: string,
  baseTransform: string,
): CSSProperties {
  const width = shape === 'pill' ? 44 : 30;
  return {
    ...hotspotButtonBaseStyle,
    left: `${hotspotX}%`,
    top: `${hotspotY}%`,
    width,
    minWidth: width,
    maxWidth: width,
    inlineSize: `${width}px`,
    minInlineSize: `${width}px`,
    maxInlineSize: `${width}px`,
    background: accent,
    ...hotspotShapeStyle(shape),
    ...hotspotAnimation(effect, accent, baseTransform),
    transform: `${baseTransform}${shape === 'diamond' ? ' rotate(45deg)' : ''}`,
  };
}

function buildHotspotIconWrapStyle(innerTransform: string | undefined): CSSProperties {
  return {
    ...hotspotIconWrapBaseStyle,
    transform: innerTransform,
  };
}

function buildHotspotCardStyle(color: string): CSSProperties {
  return {
    ...hotspotCardBaseStyle,
    color,
  };
}

function buildHotspotCardHeaderStyle(accent: string): CSSProperties {
  return {
    ...hotspotCardHeaderBaseStyle,
    color: accent,
  };
}

function HotspotModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const [open, setOpen] = useState(false);
  const accent = getAccent(node);
  const color = String(node.style.color ?? 'var(--surface-card-light)');
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  const shape = String(node.props.hotspotShape ?? 'circle');
  const icon = String(node.props.hotspotIcon ?? 'plus');
  const effect = String(node.props.hotspotEffect ?? 'pulse');
  const autoCloseMs = Math.max(0, Number(node.props.autoCloseMs ?? 2000));
  const iconKind = useMemo(() => {
    if (icon === 'arrow-up' || icon === 'arrow-down' || icon === 'arrow-left' || icon === 'arrow-right' || icon === 'info') {
      return icon;
    }
    return 'plus';
  }, [icon]);
  const baseTransform = 'translate(-50%,-50%)';
  const innerTransform = shape === 'diamond' ? 'rotate(-45deg)' : undefined;

  useEffect(() => {
    if (!open || autoCloseMs <= 0) return;
    const timeoutId = window.setTimeout(() => setOpen(false), autoCloseMs);
    return () => window.clearTimeout(timeoutId);
  }, [autoCloseMs, open]);

  return (
    <div style={buildHotspotShellStyle(color)}>
      <style>{`
        @keyframes smxHotspotPulse { 0%,100% { transform:${baseTransform} ${shape === 'diamond' ? 'rotate(45deg)' : ''} scale(1); } 50% { transform:${baseTransform} ${shape === 'diamond' ? 'rotate(45deg)' : ''} scale(1.08); } }
        @keyframes smxHotspotBounce { 0%,100% { transform:${baseTransform} ${shape === 'diamond' ? 'rotate(45deg)' : ''} translateY(0); } 50% { transform:${baseTransform} ${shape === 'diamond' ? 'rotate(45deg)' : ''} translateY(-6px); } }
        @keyframes smxHotspotPing { 0% { box-shadow:0 0 0 0 ${accent}55; } 70% { box-shadow:0 0 0 18px hsl(0 0% 0% / 0); } 100% { box-shadow:0 0 0 0 hsl(0 0% 0% / 0); } }
      `}</style>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
          ctx.triggerWidgetAction('click');
        }}
        style={buildHotspotButtonStyle(hotspotX, hotspotY, shape, effect, accent, baseTransform)}
      >
        <span style={buildHotspotIconWrapStyle(innerTransform)}>
          <ModuleHotspotIcon kind={iconKind} size={15} color="var(--neutral-slate-900)" />
        </span>
      </button>
      {open ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); setOpen(false); }} style={buildHotspotCardStyle(color)}>
          <div style={buildHotspotCardHeaderStyle(accent)}>{String(node.props.header ?? 'Interactive hotspot')}</div>
          <div style={hotspotCardBodyStyle}>{String(node.props.body ?? 'Add more context for this interactive point.')}</div>
        </button>
      ) : (
        <div style={hotspotLabelStyle}>{String(node.props.label ?? 'Tap point')}</div>
      )}
    </div>
  );
}

export function renderInteractiveHotspotStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <HotspotModuleRenderer node={node} ctx={ctx} />;
}
