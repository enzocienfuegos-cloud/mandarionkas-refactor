import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { getAccent, moduleBody, moduleHeader, moduleShell, renderCollapsedIfNeeded } from './shared-styles';

function hotspotShapeStyle(shape: string): CSSProperties {
  if (shape === 'square') return { borderRadius: 12 };
  if (shape === 'pill') return { borderRadius: 999, width: 44 };
  if (shape === 'diamond') return { borderRadius: 10, transform: 'translate(-50%,-50%) rotate(45deg)' };
  return { borderRadius: '50%' };
}

function hotspotIcon(icon: string): string {
  switch (icon) {
    case 'arrow-up': return '↑';
    case 'arrow-down': return '↓';
    case 'arrow-left': return '←';
    case 'arrow-right': return '→';
    case 'info': return 'i';
    default: return '+';
  }
}

function hotspotAnimation(effect: string, accent: string): CSSProperties {
  if (effect === 'bounce') return { animation: 'smxHotspotBounce 1.2s ease-in-out infinite' };
  if (effect === 'ping') return { boxShadow: `0 0 0 0 ${accent}55`, animation: 'smxHotspotPing 1.8s ease-out infinite' };
  if (effect === 'pulse') return { boxShadow: `0 0 0 6px ${accent}33, 0 0 0 18px ${accent}11`, animation: 'smxHotspotPulse 1.8s ease-in-out infinite' };
  return {};
}

function HotspotModuleRenderer({ node, ctx }: { node: WidgetNode; ctx: RenderContext }): JSX.Element {
  const [open, setOpen] = useState(false);
  const accent = getAccent(node);
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  const shape = String(node.props.hotspotShape ?? 'circle');
  const icon = String(node.props.hotspotIcon ?? 'plus');
  const effect = String(node.props.hotspotEffect ?? 'pulse');
  const iconChar = useMemo(() => hotspotIcon(icon), [icon]);
  const baseTransform = shape === 'diamond' ? 'translate(-50%,-50%) rotate(45deg)' : 'translate(-50%,-50%)';
  const innerTransform = shape === 'diamond' ? 'rotate(-45deg)' : undefined;

  return (
    <div style={moduleShell(node, ctx)}>
      <style>{`
        @keyframes smxHotspotPulse { 0%,100% { transform:${baseTransform} scale(1); } 50% { transform:${baseTransform} scale(1.08); } }
        @keyframes smxHotspotBounce { 0%,100% { transform:${baseTransform} translateY(0); } 50% { transform:${baseTransform} translateY(-6px); } }
        @keyframes smxHotspotPing { 0% { box-shadow:0 0 0 0 ${accent}55; } 70% { box-shadow:0 0 0 18px rgba(0,0,0,0); } 100% { box-shadow:0 0 0 0 rgba(0,0,0,0); } }
      `}</style>
      <div style={moduleHeader(node)}>{String(node.props.title ?? node.name)}</div>
      <div style={{ ...moduleBody, position: 'relative' }}>
        <div style={{ flex: 1, borderRadius: 12, background: 'linear-gradient(135deg,#1e3a8a,#172554)', position: 'relative', overflow: 'hidden' }}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setOpen(!open);
              ctx.triggerWidgetAction('click');
            }}
            style={{
              position: 'absolute',
              left: `${hotspotX}%`,
              top: `${hotspotY}%`,
              transform: baseTransform,
              width: shape === 'pill' ? 44 : 28,
              height: 28,
              border: 'none',
              background: accent,
              color: '#111827',
              fontWeight: 900,
              fontSize: 15,
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
              ...hotspotShapeStyle(shape),
              ...hotspotAnimation(effect, accent),
            }}
          >
            <span style={{ transform: innerTransform }}>{iconChar}</span>
          </button>
          {open ? (
            <div style={{ position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 14, background: 'rgba(17,24,39,.94)', padding: '10px 12px', display: 'grid', gap: 6 }}>
              <div style={{ fontSize: 12, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', color: accent }}>{String(node.props.header ?? 'Interactive hotspot')}</div>
              <div style={{ fontSize: 12, lineHeight: 1.45 }}>{String(node.props.body ?? 'Add more context for this interactive point.')}</div>
            </div>
          ) : (
            <div style={{ position: 'absolute', left: 12, bottom: 12, fontSize: 12 }}>{String(node.props.label ?? 'Tap point')}</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function renderInteractiveHotspotStage(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const collapsed = renderCollapsedIfNeeded(node, ctx);
  if (collapsed) return collapsed;
  return <HotspotModuleRenderer node={node} ctx={ctx} />;
}
