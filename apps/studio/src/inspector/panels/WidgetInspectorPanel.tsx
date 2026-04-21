import { useEffect, useMemo, useState } from 'react';
import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { DocumentInspectorPanel } from './DocumentInspectorPanel';
import { getWidgetBehaviorPanelCount, getWidgetInspectorTabs, renderWidgetInspectorTab } from '../../widgets/registry/widget-inspector-layout';
import type { WidgetDefinition, WidgetInspectorTabId } from '../../widgets/registry/widget-definition';

const EMPTY_TABS: ReturnType<typeof getWidgetInspectorTabs> = [];

export function WidgetInspectorPanel({ widgetId }: { widgetId: string }): JSX.Element {
  const widget = useStudioStore((state) => state.document.widgets[widgetId]);
  const playheadMs = useStudioStore((state) => state.ui.playheadMs);
  const actions = useStudioStore((state) => Object.values(state.document.actions).filter((action) => action.widgetId === widgetId));
  const { updateWidgetName } = useWidgetActions();
  const [tab, setTab] = useState<WidgetInspectorTabId>('basics');

  const definition = useMemo<WidgetDefinition | null>(() => (widget ? getWidgetDefinition(widget.type) : null), [widget]);
  const tabs = useMemo(() => (definition ? getWidgetInspectorTabs(definition) : EMPTY_TABS), [definition]);
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0] ?? null;
  const behaviorPanelCount = definition ? getWidgetBehaviorPanelCount(definition) : 0;

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((item) => item.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [tab, tabs]);

  if (!widget || !definition) return <DocumentInspectorPanel />;

  return (
    <>
      <section className="section section-premium">
        <div className="section-heading-row">
          <div>
            <h3>{definition.label}</h3>
            <small className="muted">{widget.type}</small>
          </div>
        </div>
        <div>
          <label>Name</label>
          <input value={widget.name} onChange={(event) => updateWidgetName(widget.id, event.target.value)} />
        </div>
      </section>

      <div className="inspector-tabs">
        {tabs.map((item) => (
          <button key={item.id} className={tab === item.id ? 'primary' : 'ghost'} onClick={() => setTab(item.id)}>
            {item.label ?? item.id}
          </button>
        ))}
      </div>

      {activeTab ? renderWidgetInspectorTab(activeTab, { widget, definition, playheadMs, actions }) : null}

      {activeTab?.id === 'behavior' && !behaviorPanelCount ? (
        <section className="section section-premium inspector-empty-card">
          <h3>Behavior</h3>
          <small className="muted">This widget does not expose behavior controls yet.</small>
        </section>
      ) : null}
    </>
  );
}
