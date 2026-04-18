import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { baseTextStyle, resolveCssTextAlign, resolveTextHorizontalAlign, resolveTextVerticalAlign } from '../../canvas/stage/render-helpers';

export function renderBadgeWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const frame = node.frame;
  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: frame.x,
    top: frame.y,
    width: frame.width,
    height: frame.height,
    transform: `rotate(${frame.rotation}deg)`,
    display: 'inline-flex',
    alignItems: resolveTextVerticalAlign(node),
    justifyContent: resolveTextHorizontalAlign(node),
    gap: 8,
    padding: '0 14px',
    borderRadius: Number(node.style.borderRadius ?? 999),
    background: String(node.style.backgroundColor ?? '#7c3aed'),
    border: `1px solid ${String(node.style.borderColor ?? 'rgba(255,255,255,0.18)')}`,
    boxShadow: String(node.style.boxShadow ?? '0 12px 24px rgba(0,0,0,0.18)'),
    opacity: Number(node.style.opacity ?? 1),
    overflow: 'hidden',
    boxSizing: 'border-box',
  };

  const textStyle: CSSProperties = {
    ...baseTextStyle(node, ctx),
    width: 'auto',
    height: 'auto',
    textAlign: resolveCssTextAlign(node),
    whiteSpace: 'nowrap',
    fontSize: Number(node.style.fontSize ?? 16),
    fontWeight: Number(node.style.fontWeight ?? 800),
    letterSpacing: String(node.style.letterSpacing ?? '0.02em'),
  };

  const icon = String(node.props.icon ?? '').trim();
  const text = String(node.props.text ?? 'Badge');

  return (
    <div style={containerStyle}>
      {icon ? <span aria-hidden="true" style={{ fontSize: Number(node.style.fontSize ?? 16) }}>{icon}</span> : null}
      <span style={textStyle}>{text}</span>
    </div>
  );
}
