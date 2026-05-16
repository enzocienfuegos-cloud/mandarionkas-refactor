import type { WidgetPropertyClipboardPayload } from '../core/commands/types';
import type { WidgetNode } from '../domain/document/types';

let widgetPropertyClipboard: WidgetPropertyClipboardPayload | null = null;
const listeners = new Set<() => void>();

function emitClipboardChange(): void {
  listeners.forEach((listener) => listener());
}

export function buildWidgetPropertyClipboardPayload(widget: WidgetNode): WidgetPropertyClipboardPayload {
  return {
    widgetType: widget.type,
    widgetName: widget.name,
    props: JSON.parse(JSON.stringify(widget.props ?? {})) as Record<string, unknown>,
    style: JSON.parse(JSON.stringify(widget.style ?? {})) as Record<string, unknown>,
    motion: widget.motion ? JSON.parse(JSON.stringify(widget.motion)) as WidgetNode['motion'] : undefined,
    hoverMotion: widget.hoverMotion ? JSON.parse(JSON.stringify(widget.hoverMotion)) as WidgetNode['hoverMotion'] : undefined,
    copiedAt: new Date().toISOString(),
  };
}

export function setWidgetPropertyClipboardPayload(payload: WidgetPropertyClipboardPayload | null): void {
  widgetPropertyClipboard = payload ? JSON.parse(JSON.stringify(payload)) as WidgetPropertyClipboardPayload : null;
  emitClipboardChange();
}

export function getWidgetPropertyClipboardPayload(): WidgetPropertyClipboardPayload | null {
  return widgetPropertyClipboard ? JSON.parse(JSON.stringify(widgetPropertyClipboard)) as WidgetPropertyClipboardPayload : null;
}

export function subscribeToWidgetPropertyClipboard(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
