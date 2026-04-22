import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { DocumentInspectorPanel } from './DocumentInspectorPanel';
import { getWidgetBehaviorPanelCount, getWidgetInspectorPanelMeta, getWidgetInspectorTabs, renderWidgetInspectorPanel } from '../../widgets/registry/widget-inspector-layout';
import type { WidgetDefinition, WidgetInspectorTabId } from '../../widgets/registry/widget-definition';

const EMPTY_TABS: ReturnType<typeof getWidgetInspectorTabs> = [];

function WidgetInspectorAccordion({
  title,
  subtitle,
  defaultOpen = false,
  children,
}: {
  title: string;
  subtitle: string;
  defaultOpen?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details className="inspector-accordion" open={open} onToggle={(event) => setOpen((event.currentTarget as HTMLDetailsElement).open)}>
      <summary>
        <span>{title}</span>
        <small>{subtitle}</small>
      </summary>
      <div className="inspector-accordion-body">
        {children}
      </div>
    </details>
  );
}

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

      {activeTab ? (
        <>
          {activeTab.panels.map((panelKey, index) => {
            const panel = renderWidgetInspectorPanel(panelKey, { widget, definition, playheadMs, actions });
            if (!panel) return null;
            const meta = getWidgetInspectorPanelMeta(panelKey);
            const shouldOpen = meta.defaultOpen ?? (activeTab.id === 'basics' && index === 0);
            return (
              <WidgetInspectorAccordion key={panelKey} title={meta.title} subtitle={meta.subtitle} defaultOpen={shouldOpen}>
                  {panel}
              </WidgetInspectorAccordion>
            );
          })}
        </>
      ) : null}

      {activeTab?.id === 'behavior' && !behaviorPanelCount ? (
        <section className="section section-premium inspector-empty-card">
          <h3>Behavior</h3>
          <small className="muted">This widget does not expose behavior controls yet.</small>
        </section>
      ) : null}
    </>
  );
}
