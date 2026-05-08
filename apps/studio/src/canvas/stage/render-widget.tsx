import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from './render-context';
import type { WidgetDefinition } from '../../widgets/registry/widget-definition';

export function defaultWireframe(node: WidgetNode, definition: Pick<WidgetDefinition, 'label'>): JSX.Element {
  return (
    <div className="widget-wireframe">
      <span className="widget-wireframe__label">{definition.label}</span>
      <span className="widget-wireframe__dims">
        {Math.round(node.frame.width)}
        ×
        {Math.round(node.frame.height)}
      </span>
    </div>
  );
}

export function renderWidgetContents(
  node: WidgetNode,
  ctx: RenderContext,
  options?: { wireframe?: boolean },
): JSX.Element {
  const definition = getWidgetDefinition(node.type);
  if (options?.wireframe) {
    return definition.renderWireframe
      ? definition.renderWireframe(node, ctx)
      : defaultWireframe(node, definition);
  }
  if (definition.renderStage) {
    return definition.renderStage(node, ctx);
  }
  return <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{definition.label}</div>;
}
