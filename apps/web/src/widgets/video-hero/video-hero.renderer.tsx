import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';

export function renderVideoHeroWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const borderRadius = Number(node.style.borderRadius ?? 18);
  const src = String(node.props.src ?? '').trim();
  if (src) {
    return (
      <video
        src={src}
        poster={String(node.props.posterSrc ?? '') || undefined}
        draggable={false}
        autoPlay={Boolean(node.props.autoplay ?? true)}
        muted={Boolean(node.props.muted ?? true)}
        loop={Boolean(node.props.loop ?? true)}
        controls={Boolean(node.props.controls ?? false)}
        style={{
          width: '100%',
          height: '100%',
          objectFit: String(node.style.fit ?? 'cover') as CSSProperties['objectFit'],
          borderRadius,
          border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
          opacity: resolveWidgetOpacity(node, ctx),
          display: 'block',
          background: resolveWidgetBackground(node, '#0f172a', ctx),
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: resolveWidgetBackground(node, '#0f172a', ctx),
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
      Video hero placeholder
    </div>
  );
}
