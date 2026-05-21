import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { resolveCornerRadius } from '../shared/corner-style';
import { readOverlayFromStyle, overlayToCssProperties } from '../../shared/style/overlay';

function buildHeroImageMediaStyle(
  node: WidgetNode,
  ctx: RenderContext,
  borderRadius: number,
): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    objectFit: String(node.style.fit ?? 'cover') as CSSProperties['objectFit'],
    objectPosition: `${String(node.props.focalX ?? 50)}% ${String(node.props.focalY ?? 50)}%`,
    borderRadius,
    border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
    opacity: resolveWidgetOpacity(node, ctx),
    display: 'block',
    background: resolveWidgetBackground(node, '#223142', ctx),
  };
}

function buildHeroImagePlaceholderStyle(
  node: WidgetNode,
  ctx: RenderContext,
  borderRadius: number,
): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    background: resolveWidgetBackground(node, '#223142', ctx),
    borderRadius,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#bdd0df',
    fontSize: 14,
    border: `1px dashed ${resolveWidgetBorder(node, ctx)}`,
    opacity: resolveWidgetOpacity(node, ctx),
  };
}

export function renderHeroImageWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const borderRadius = resolveCornerRadius(node, 20);
  const src = String(node.props.src ?? '').trim();
  const overlayStyle = overlayToCssProperties(readOverlayFromStyle(node.style));

  if (src) {
    return (
      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
        <img
          src={src}
          alt={String(node.props.alt ?? node.name)}
          decoding="async"
          draggable={false}
          style={buildHeroImageMediaStyle(node, ctx, borderRadius)}
        />
        {overlayStyle ? <div style={overlayStyle} /> : null}
      </div>
    );
  }
  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <div style={buildHeroImagePlaceholderStyle(node, ctx, borderRadius)}>
        Hero image placeholder
      </div>
      {overlayStyle ? <div style={overlayStyle} /> : null}
    </div>
  );
}
