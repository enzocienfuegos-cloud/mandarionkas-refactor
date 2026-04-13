import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from './render-context';

export function renderWidgetContents(node: WidgetNode, ctx: RenderContext): JSX.Element {
  const definition = getWidgetDefinition(node.type);
  if (definition.renderStage) {
    return definition.renderStage(node, ctx);
  }
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{definition.label}</div>;
}
