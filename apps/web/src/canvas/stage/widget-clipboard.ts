import type { WidgetClipboardPayload } from '../../core/commands/types';
import type { StudioState, WidgetNode } from '../../domain/document/types';

let widgetClipboard: WidgetClipboardPayload | null = null;

function collectWidgetIds(state: StudioState): string[] {
  const selected = state.document.selection.widgetIds;
  const queue = [...selected];
  const seen = new Set<string>();

  while (queue.length) {
    const widgetId = queue.shift();
    if (!widgetId || seen.has(widgetId)) continue;
    seen.add(widgetId);
    const widget = state.document.widgets[widgetId];
    if (!widget) continue;
    (widget.childIds ?? []).forEach((childId) => queue.push(childId));
  }

  return [...seen];
}

export function buildWidgetClipboardPayload(state: StudioState): WidgetClipboardPayload | null {
  const widgetIds = collectWidgetIds(state);
  if (!widgetIds.length) return null;

  const widgets = widgetIds
    .map((widgetId) => state.document.widgets[widgetId])
    .filter(Boolean)
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((widget) => JSON.parse(JSON.stringify(widget)) as WidgetNode);

  const actions = Object.values(state.document.actions)
    .filter((action) => widgetIds.includes(action.widgetId))
    .map((action) => JSON.parse(JSON.stringify(action)));

  return { widgets, actions };
}

export function setWidgetClipboardPayload(payload: WidgetClipboardPayload | null): void {
  widgetClipboard = payload;
}

export function getWidgetClipboardPayload(): WidgetClipboardPayload | null {
  return widgetClipboard ? JSON.parse(JSON.stringify(widgetClipboard)) as WidgetClipboardPayload : null;
}
