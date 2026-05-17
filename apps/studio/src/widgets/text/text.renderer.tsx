import type { WidgetNode } from '../../domain/document/types';
import type { CSSProperties } from 'react';
import type { RenderContext } from '../../canvas/stage/render-context';
import { baseTextStyle, resolveCssTextAlign, resolveTextHorizontalAlign, resolveTextVerticalAlign } from '../../canvas/stage/render-helpers';
import { readShadowFromStyle, shadowConfigToTextShadow } from '../../shared/style/shadow';

function buildTextLayoutStyle(node: WidgetNode): CSSProperties {
  return {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: resolveTextVerticalAlign(node),
    justifyContent: resolveTextHorizontalAlign(node),
    textAlign: resolveCssTextAlign(node),
  };
}

export function renderTextWidget(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const textStyle: CSSProperties = {
    ...baseTextStyle(node, ctx),
    textShadow: shadowConfigToTextShadow(readShadowFromStyle(node.style)),
  };
  return (
    <div style={buildTextLayoutStyle(node)}>
      <div style={textStyle}>{String(node.props.text ?? '')}</div>
    </div>
  );
}
