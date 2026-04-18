import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { resolveWidgetBackground, resolveWidgetBorder, resolveWidgetOpacity } from '../../canvas/stage/render-helpers';
import { buildShapeInnerStyle } from './shape-shared';

export function renderShapeWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const fill = resolveWidgetBackground(node, '#f6a11c', ctx);
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
