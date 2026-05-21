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
  // Default to true — any widget supports motion unless explicitly opted out with false.
  // Widgets that want to block motion (e.g. group's hover motion) set the flag to false.
  return explicit !== false;
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
