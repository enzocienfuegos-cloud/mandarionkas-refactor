import { describe, expect, it } from 'vitest';
import {
  createWidgetLibraryDragPayload,
  parseWidgetLibraryDragPayload,
  readWidgetLibraryDragPayload,
  serializeWidgetLibraryDragPayload,
  WIDGET_LIBRARY_DRAG_MIME,
} from '../../../canvas/stage/widget-library-drag';

describe('widget library drag payload', () => {
  it('serializes and parses a widget payload', () => {
    const payload = createWidgetLibraryDragPayload('text', 'Text');
    const serialized = serializeWidgetLibraryDragPayload(payload);

    expect(parseWidgetLibraryDragPayload(serialized)).toEqual(payload);
  });

  it('rejects malformed payloads', () => {
    expect(parseWidgetLibraryDragPayload('{"kind":"oops"}')).toBeNull();
    expect(parseWidgetLibraryDragPayload('not json')).toBeNull();
    expect(parseWidgetLibraryDragPayload('')).toBeNull();
  });

  it('reads the payload from the drag mime type', () => {
    const payload = createWidgetLibraryDragPayload('image', 'Image');
    const serialized = serializeWidgetLibraryDragPayload(payload);
    const dataTransfer = {
      getData: (type: string) => type === WIDGET_LIBRARY_DRAG_MIME ? serialized : '',
    };

    expect(readWidgetLibraryDragPayload(dataTransfer)).toEqual(payload);
  });
});
