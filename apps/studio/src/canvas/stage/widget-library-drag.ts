import type { WidgetType } from '../../domain/document/types';

export const WIDGET_LIBRARY_DRAG_MIME = 'application/x-smx-widget-library-item';

let activeWidgetLibraryDragPayload: WidgetLibraryDragPayload | null = null;

export type WidgetLibraryDragPayload = {
  kind: 'widget-library-item';
  source: 'widget-library';
  widgetType: WidgetType;
  widgetLabel: string;
};

export function createWidgetLibraryDragPayload(widgetType: WidgetType, widgetLabel: string): WidgetLibraryDragPayload {
  return {
    kind: 'widget-library-item',
    source: 'widget-library',
    widgetType,
    widgetLabel,
  };
}

export function serializeWidgetLibraryDragPayload(payload: WidgetLibraryDragPayload): string {
  return JSON.stringify(payload);
}

export function parseWidgetLibraryDragPayload(raw: string | null | undefined): WidgetLibraryDragPayload | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<WidgetLibraryDragPayload>;
    if (parsed.kind !== 'widget-library-item') return null;
    if (parsed.source !== 'widget-library') return null;
    if (typeof parsed.widgetType !== 'string' || typeof parsed.widgetLabel !== 'string') return null;
    return {
      kind: 'widget-library-item',
      source: 'widget-library',
      widgetType: parsed.widgetType,
      widgetLabel: parsed.widgetLabel,
    };
  } catch {
    return null;
  }
}

export function writeWidgetLibraryDragPayload(dataTransfer: DataTransfer | null | undefined, payload: WidgetLibraryDragPayload): void {
  activeWidgetLibraryDragPayload = payload;
  if (!dataTransfer) return;
  const serialized = serializeWidgetLibraryDragPayload(payload);
  dataTransfer.effectAllowed = 'copy';
  dataTransfer.setData(WIDGET_LIBRARY_DRAG_MIME, serialized);
  dataTransfer.setData('application/json', serialized);
  dataTransfer.setData('text/plain', payload.widgetLabel);
}

export function readWidgetLibraryDragPayload(dataTransfer: Pick<DataTransfer, 'getData'> | null | undefined): WidgetLibraryDragPayload | null {
  if (!dataTransfer) return activeWidgetLibraryDragPayload;
  return (
    parseWidgetLibraryDragPayload(dataTransfer.getData(WIDGET_LIBRARY_DRAG_MIME))
    ?? parseWidgetLibraryDragPayload(dataTransfer.getData('application/json'))
    ?? activeWidgetLibraryDragPayload
  );
}

export function clearWidgetLibraryDragPayload(): void {
  activeWidgetLibraryDragPayload = null;
}
