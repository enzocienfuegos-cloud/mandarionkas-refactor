import type { WidgetNode } from '../domain/document/types';
import type { WidgetCapabilities } from '../widgets/registry/widget-definition';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import type { MotionTemplate } from './motion-template-contract';

function supportsWidgetCapability(
  widget: Pick<WidgetNode, 'type'>,
  capabilityKey: 'supportsMotion' | 'supportsHoverMotion',
): boolean {
  const definition = getWidgetDefinition(widget.type);
  const capabilities = definition.capabilities;
  const explicit = capabilityKey === 'supportsHoverMotion' ? capabilities?.supportsHoverMotion : capabilities?.supportsMotion;
  return explicit === true;
}

export function widgetSupportsMotion(widget: Pick<WidgetNode, 'type'>, template?: MotionTemplate): boolean {
  const definition = getWidgetDefinition(widget.type);
  const capabilities: WidgetCapabilities | undefined = definition.capabilities;
  if (!supportsWidgetCapability(widget, 'supportsMotion')) return false;
  return template?.supportsWidgetType ? template.supportsWidgetType(widget.type, capabilities) : true;
}

export function widgetSupportsHoverMotion(widget: Pick<WidgetNode, 'type'>, template?: MotionTemplate): boolean {
  const definition = getWidgetDefinition(widget.type);
  const capabilities: WidgetCapabilities | undefined = definition.capabilities;
  if (!supportsWidgetCapability(widget, 'supportsHoverMotion')) return false;
  return template?.supportsWidgetType ? template.supportsWidgetType(widget.type, capabilities) : true;
}
