import { describe, expect, it } from 'vitest';
import { listWidgetDefinitions } from '../../../widgets/registry/widget-registry';
import { hasInspectorSection } from '../../../widgets/registry/widget-definition';

describe('widget definition contract', () => {
  it('keeps every registered widget audit-safe for library, inspector and export', () => {
    for (const widget of listWidgetDefinitions()) {
      expect(widget.description, `${widget.type} missing description`).toBeTruthy();
      expect(widget.thumbnail, `${widget.type} missing thumbnail`).toBeTruthy();
      expect(
        widget.renderInspector
        || widget.inspectorFields?.length
        || widget.inspectorSections.length
        || hasInspectorSection(widget, 'module-config'),
        `${widget.type} missing inspector path`,
      ).toBeTruthy();
      expect(widget.renderExport, `${widget.type} missing export renderer`).toBeTruthy();
    }
  });
});
