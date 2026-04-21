import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from '../../canvas/stage/render-context';
import { baseTextStyle, resolveCssTextAlign, resolveTextHorizontalAlign, resolveTextVerticalAlign, resolveWidgetBackground, resolveWidgetBorder } from '../../canvas/stage/render-helpers';

export function renderCtaWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  return (
    <div
      style={{
        ...baseTextStyle(node, ctx),
        display: 'flex',
        alignItems: resolveTextVerticalAlign(node),
        justifyContent: resolveTextHorizontalAlign(node),
        textAlign: resolveCssTextAlign(node),
        width: '100%',
        height: '100%',
        borderRadius: 10,
        background: resolveWidgetBackground(node, '#ffd400', ctx),
        border: `1px solid ${resolveWidgetBorder(node, ctx)}`,
      }}
    >
      {String(node.props.text ?? 'CTA')}
    </div>
  );
}
