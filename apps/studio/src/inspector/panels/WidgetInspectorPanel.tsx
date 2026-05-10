import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { Tabs } from '../../shared/ui/Tabs';
import { getAccordionOpenState, setAccordionOpenState } from '../inspector-preferences';
import { resolveWidgetForCanvasVariant } from '../../domain/document/canvas-variants';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { DocumentInspectorPanel } from './DocumentInspectorPanel';
import { getWidgetBehaviorPanelCount, getWidgetInspectorPanelMeta, getWidgetInspectorTabs, renderWidgetInspectorPanel } from '../../widgets/registry/widget-inspector-layout';
import { getCapability, type WidgetDefinition, type WidgetInspectorPanelKey, type WidgetInspectorTabId } from '../../widgets/registry/widget-definition';
import { usePlaybackMs } from '../../hooks/use-playback-engine';

const EMPTY_TABS: ReturnType<typeof getWidgetInspectorTabs> = [];

function buildInspectorHeroPills(definition: WidgetDefinition, widget: NonNullable<ReturnType<typeof resolveWidgetForCanvasVariant>>): string[] {
  const pills: string[] = [];
  pills.push(definition.category);
  if (getCapability(definition, 'isInteractive')) pills.push('Interactive');
  if (getCapability(definition, 'isMedia')) pills.push('Media');
  if (getCapability(definition, 'acceptsAssetSwap')) pills.push('Asset swap');
  if (definition.mraidCompatibility === 'supported') pills.push('MRAID ready');
  if (definition.mraidCompatibility === 'warning') pills.push('MRAID review');
  pills.push(`${Math.round(widget.frame.width)}×${Math.round(widget.frame.height)}`);
  return pills.slice(0, 4);
}

function WidgetInspectorAccordion({
  widgetType,
  panelKey,
  title,
  subtitle,
  fallbackOpen = false,
  children,
}: {
  widgetType: string;
  panelKey: WidgetInspectorPanelKey;
  title: string;
  subtitle: string;
  fallbackOpen?: boolean;
  children: ReactNode;
}): JSX.Element {
  const [open, setOpen] = useState(() => getAccordionOpenState(widgetType, panelKey, fallbackOpen));

  useEffect(() => {
    setOpen(getAccordionOpenState(widgetType, panelKey, fallbackOpen));
  }, [fallbackOpen, panelKey, widgetType]);

  return (
    <details
      className="inspector-accordion"
      open={open}
      onToggle={(event) => {
        const next = (event.currentTarget as HTMLDetailsElement).open;
        setOpen(next);
        setAccordionOpenState(widgetType, panelKey, next);
      }}
    >
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
  const state = useStudioStore((current) => current);
  const widget = useStudioStore((current) => resolveWidgetForCanvasVariant(current.document, current.document.widgets[widgetId]));
  const storePlayheadMs = useStudioStore((state) => state.ui.playheadMs);
  const playheadMs = usePlaybackMs(storePlayheadMs);
  const actions = useStudioStore((state) => Object.values(state.document.actions).filter((action) => action.widgetId === widgetId));
  const { updateWidgetName } = useWidgetActions();
  const [tab, setTab] = useState<WidgetInspectorTabId>('basics');

  const definition = useMemo<WidgetDefinition | null>(() => (widget ? getWidgetDefinition(widget.type) : null), [widget]);
  const tabs = useMemo(() => (definition && widget ? getWidgetInspectorTabs(definition, widget, state) : EMPTY_TABS), [definition, state, widget]);
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0] ?? null;
  const behaviorPanelCount = definition && widget ? getWidgetBehaviorPanelCount(definition, widget, state) : 0;

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((item) => item.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [tab, tabs]);

  if (!widget || !definition) return <DocumentInspectorPanel />;

  const heroPills = buildInspectorHeroPills(definition, widget);

  return (
    <>
      <section className="section section-premium inspector-widget-hero">
        <div className="section-heading-row">
          <div>
            <div className="left-title">Widget focus</div>
            <h3>{definition.label}</h3>
            <small className="muted">{definition.description ?? 'Core editing controls for this module stay anchored at the top.'}</small>
          </div>
          <div className="inspector-widget-hero__meta">
            <span className="pill">{widget.type}</span>
            <span className="pill">{tabs.length} tabs</span>
          </div>
        </div>
        <div className="inspector-widget-hero__pills">
          {heroPills.map((item) => (
            <span key={item} className="pill">{item}</span>
          ))}
        </div>
        <div>
          <label>Name</label>
          <input value={widget.name} onChange={(event) => updateWidgetName(widget.id, event.target.value)} />
        </div>
      </section>

      <Tabs
        tabs={tabs.map((item) => ({ id: item.id, label: item.label ?? item.id }))}
        activeId={tab}
        onChange={setTab}
        ariaLabel="Widget inspector sections"
        idBase="widget-inspector"
        className="inspector-tabs"
      />

      {activeTab ? (
        <section className="inspector-tab-panel" role="tabpanel" id={`widget-inspector-panel-${activeTab.id}`} aria-labelledby={`widget-inspector-tab-${activeTab.id}`}>
          {activeTab.panels.map((panelKey, index) => {
            const panel = renderWidgetInspectorPanel(panelKey, { widget, definition, state, playheadMs, actions });
            if (!panel) return null;
            const meta = getWidgetInspectorPanelMeta(panelKey);
            const shouldOpen = meta.defaultOpen ?? (activeTab.id === 'basics' && index === 0);
            return (
              <WidgetInspectorAccordion
                key={panelKey}
                widgetType={widget.type}
                panelKey={panelKey}
                title={meta.title}
                subtitle={meta.subtitle}
                fallbackOpen={shouldOpen}
              >
                {panel}
              </WidgetInspectorAccordion>
            );
          })}
        </section>
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
