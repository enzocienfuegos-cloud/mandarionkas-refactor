import { describe, expect, it } from 'vitest';
import { createInitialState } from '../../../domain/document/factories';
import { getWidgetFieldPanelKey, resolveInspectorTabs } from '../../../widgets/registry/widget-definition';
import { textDefinition } from '../../../widgets/text/text.definition';
import { groupDefinition } from '../../../widgets/group/group.definition';
import { CountdownDefinition } from '../../../widgets/modules/definitions/countdown.definition';
import { getWidgetInspectorTabs } from '../../../widgets/registry/widget-inspector-layout';

describe('widget inspector layout', () => {
  it('derives fallback tabs from widget capabilities', () => {
    const tabs = resolveInspectorTabs(textDefinition);
    expect(tabs.map((tab) => tab.id)).toEqual(['basics', 'behavior', 'data']);
    expect(tabs[0]?.panels).toEqual(['position-size', 'text-content', 'shadow', 'timing']);
    expect(tabs[1]?.panels).toContain('keyframes');
    expect(tabs[2]?.panels).toEqual(['data-bindings', 'variants']);
  });

  it('prefers widget-owned fields over generic module config when available', () => {
    expect(getWidgetFieldPanelKey(groupDefinition)).toBe('widget-fields');
    expect(groupDefinition.inspectorTabs?.[0]?.panels).toContain('widget-fields');
  });

  it('lets module factory publish plugin-owned tabs', () => {
    expect(CountdownDefinition.inspectorTabs?.map((tab) => tab.id)).toEqual(['basics', 'behavior', 'data']);
    expect(CountdownDefinition.inspectorTabs?.[0]?.panels).toEqual(['position-size', 'widget-fields', 'fill', 'timing']);
  });

  it('filters conditional inspector panels when the visibility predicate fails', () => {
    const state = createInitialState();
    const widget = CountdownDefinition.defaults(state.document.scenes[0].id, 0);

    expect(getWidgetInspectorTabs(CountdownDefinition, widget, state).find((tab) => tab.id === 'data')?.panels).toEqual(['data-bindings']);

    widget.bindings = {
      title: { source: 'product', field: 'title' },
    };

    expect(getWidgetInspectorTabs(CountdownDefinition, widget, state).find((tab) => tab.id === 'data')?.panels).toEqual(['data-bindings', 'variants']);
  });
});
