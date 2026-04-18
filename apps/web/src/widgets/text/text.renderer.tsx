import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { baseTextStyle, resolveCssTextAlign, resolveTextHorizontalAlign, resolveTextVerticalAlign } from '../../canvas/stage/render-helpers';

export function renderTextWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: resolveTextVerticalAlign(node),
        justifyContent: resolveTextHorizontalAlign(node),
        textAlign: resolveCssTextAlign(node),
      }}
    >
      <div style={baseTextStyle(node, ctx)}>{String(node.props.text ?? '')}</div>
    </div>
  );
}
