import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { buildShapeClipPath, buildShapeInnerStyle, resolveShapeKind } from './shape-shared';
import { ShapeMaskInspector } from './shape-mask-inspector';

export function renderShapeMaskInspector(node: WidgetNode): JSX.Element {
  return <ShapeMaskInspector node={node} />;
}

export function renderShapeWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const fill = resolveWidgetBackground(node, '#f6a11c', ctx);
  const maskSrc = String(node.props.maskSrc ?? '').trim();
  const shape = resolveShapeKind(node);
  const clipPath = buildShapeClipPath(node);
  const fit = String(node.props.maskFit ?? 'cover') as CSSProperties['objectFit'];
  const focalX = Number(node.props.maskFocalX ?? 50);
  const focalY = Number(node.props.maskFocalY ?? 50);

  // With image mask: use clip-path + overflow hidden on the wrapper
  if (maskSrc && clipPath) {
    return (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: resolveWidgetOpacity(node, ctx),
        }}
      >
        <div
          style={{
            ...buildShapeInnerStyle(node, fill),
            overflow: 'hidden',
            clipPath,
            position: 'relative',
            border: 'none',
          }}
        >
          <img
            src={maskSrc}
            alt=""
            draggable={false}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: fit,
              objectPosition: `${focalX}% ${focalY}%`,
              display: 'block',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>
    );
  }

  // No mask: original solid shape
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: resolveWidgetOpacity(node, ctx),
      }}
    >
      <div
        style={{
          ...buildShapeInnerStyle(node, fill),
          border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}
