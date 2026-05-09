import type { SceneNode, WidgetNode } from '../../../domain/document/types';

export type LayerOutlineItem = {
  widget: WidgetNode;
  depth: number;
  children: LayerOutlineItem[];
};

export function buildLayerOutline(
  scene: Pick<SceneNode, 'widgetIds'>,
  nodes: Record<string, WidgetNode | undefined>,
): LayerOutlineItem[] {
  const visited = new Set<string>();

  function buildChildren(parentId: string | undefined, depth: number): LayerOutlineItem[] {
    return scene.widgetIds
      .map((widgetId) => nodes[widgetId])
      .filter((widget): widget is WidgetNode => Boolean(widget))
      .filter((widget) => widget.parentId === parentId)
      .filter((widget) => {
        if (visited.has(widget.id)) return false;
        visited.add(widget.id);
        return true;
      })
      .map((widget) => ({
        widget,
        depth,
        children: buildChildren(widget.id, depth + 1),
      }));
  }

  return buildChildren(undefined, 0);
}

export function flattenVisibleLayerIds(
  items: LayerOutlineItem[],
  collapsedGroupIds: ReadonlySet<string>,
): string[] {
  const result: string[] = [];

  function visit(item: LayerOutlineItem): void {
    result.push(item.widget.id);
    if (collapsedGroupIds.has(item.widget.id)) return;
    item.children.forEach(visit);
  }

  items.forEach(visit);
  return result;
}

export function flattenVisibleLayerItems(
  items: LayerOutlineItem[],
  collapsedGroupIds: ReadonlySet<string>,
): LayerOutlineItem[] {
  const result: LayerOutlineItem[] = [];

  function visit(item: LayerOutlineItem): void {
    result.push(item);
    if (collapsedGroupIds.has(item.widget.id)) return;
    item.children.forEach(visit);
  }

  items.forEach(visit);
  return result;
}

export function getWidgetReorderSteps(
  widgetIds: string[],
  draggedId: string,
  targetId: string,
): Array<'forward' | 'backward'> {
  const fromIndex = widgetIds.indexOf(draggedId);
  const targetIndex = widgetIds.indexOf(targetId);
  if (fromIndex === -1 || targetIndex === -1 || fromIndex === targetIndex) return [];

  const remaining = widgetIds.filter((widgetId) => widgetId !== draggedId);
  const destinationIndex = remaining.indexOf(targetId);
  if (destinationIndex === -1) return [];

  const delta = destinationIndex - fromIndex;
  if (delta === 0) return [];

  const direction = delta > 0 ? 'forward' : 'backward';
  return Array.from({ length: Math.abs(delta) }, () => direction);
}
