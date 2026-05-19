import type { WidgetNode } from '../../../domain/document/types';

export type WidgetParentChain = readonly WidgetNode[];

const cache = new WeakMap<readonly WidgetNode[], WeakMap<Record<string, WidgetNode>, ReadonlyMap<string, WidgetParentChain>>>();

export function getParentChainByWidgetId(
  widgets: readonly WidgetNode[],
  widgetsById: Record<string, WidgetNode>,
): ReadonlyMap<string, WidgetParentChain> {
  let byWidgets = cache.get(widgets);
  if (!byWidgets) {
    byWidgets = new WeakMap<Record<string, WidgetNode>, ReadonlyMap<string, WidgetParentChain>>();
    cache.set(widgets, byWidgets);
  }

  const existing = byWidgets.get(widgetsById);
  if (existing) return existing;

  const result = buildParentChainByWidgetId(widgets, widgetsById);
  byWidgets.set(widgetsById, result);
  return result;
}

function buildParentChainByWidgetId(
  widgets: readonly WidgetNode[],
  widgetsById: Record<string, WidgetNode>,
): ReadonlyMap<string, WidgetParentChain> {
  const result = new Map<string, WidgetParentChain>();
  widgets.forEach((widget) => {
    const chain: WidgetNode[] = [];
    const visited = new Set<string>([widget.id]);
    let currentParentId = widget.parentId;
    while (currentParentId && !visited.has(currentParentId)) {
      visited.add(currentParentId);
      const parent = widgetsById[currentParentId];
      if (!parent) break;
      chain.push(parent);
      currentParentId = parent.parentId;
    }
    result.set(widget.id, chain);
  });
  return result;
}
