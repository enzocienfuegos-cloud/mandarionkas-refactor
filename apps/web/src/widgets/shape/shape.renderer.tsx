import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';

export function renderShapeWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: resolveWidgetBackground(node, '#f6a11c', ctx),
        borderRadius: 16,
        border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
        opacity: resolveWidgetOpacity(node, ctx),
      }}
    />
  );
}
