import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { baseTextStyle } from '../../canvas/stage/render-helpers';

export function renderTextWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return <div style={baseTextStyle(node, ctx)}>{String(node.props.text ?? '')}</div>;
}
