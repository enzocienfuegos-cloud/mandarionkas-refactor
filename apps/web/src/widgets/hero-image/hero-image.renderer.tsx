import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { resolveCornerRadius } from '../shared/corner-style';

export function renderHeroImageWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const borderRadius = resolveCornerRadius(node, 20);
  const src = String(node.props.src ?? '').trim();
  if (src) {
    return (
      <img
        src={src}
        alt={String(node.props.alt ?? node.name)}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: String(node.style.fit ?? 'cover') as CSSProperties['objectFit'],
          objectPosition: `${String(node.props.focalX ?? 50)}% ${String(node.props.focalY ?? 50)}%`,
          borderRadius,
          border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
          opacity: resolveWidgetOpacity(node, ctx),
          display: 'block',
          background: resolveWidgetBackground(node, '#223142', ctx),
        }}
      />
    );
  }
  return (
    <div
      style={{
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
      }}
    >
      Hero image placeholder
    </div>
  );
}
