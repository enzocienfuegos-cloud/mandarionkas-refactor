import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { shallowEqual, useStudioStore, useStudioStoreSnapshot } from '../../core/store/use-studio-store';
import { useTimelineActions, useWidgetActions } from '../../hooks/use-studio-actions';
import { Tabs } from '../../shared/ui/Tabs';
import { getAccordionOpenState, setAccordionOpenState } from '../inspector-preferences';
import { resolveWidgetForCanvasVariant } from '../../domain/document/canvas-variants';
import { getWidgetDefinition } from '../../widgets/registry/widget-registry';
import { DocumentInspectorPanel } from './DocumentInspectorPanel';
import { getWidgetBehaviorPanelCount, getWidgetInspectorPanelMeta, getWidgetInspectorTabs, renderWidgetInspectorPanel } from '../../widgets/registry/widget-inspector-layout';
import type { WidgetDefinition, WidgetInspectorPanelKey, WidgetInspectorTabId } from '../../widgets/registry/widget-definition';
import { usePlaybackMsThrottled } from '../../hooks/use-playback-engine';
import { Button } from '../../shared/ui/Button';
import { applyAnimationPreset, supportsAnimationPresets } from '../sections/animation-presets';
import { resolveWidgetMotionSelection } from '../../motion/motion-model';
import {
  buildWidgetPropertyClipboardPayload,
  getWidgetPropertyClipboardPayload,
  setWidgetPropertyClipboardPayload,
  subscribeToWidgetPropertyClipboard,
} from '../widget-properties-clipboard';

const EMPTY_TABS: ReturnType<typeof getWidgetInspectorTabs> = [];

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
  const state = useStudioStoreSnapshot();
  const widget = useStudioStore((current) => resolveWidgetForCanvasVariant(current.document, current.document.widgets[widgetId]), shallowEqual);
  const storePlayheadMs = useStudioStore((state) => state.ui.playheadMs);
  const inspectorFocus = useStudioStore((state) => state.ui.inspectorFocus);
  const playheadMs = usePlaybackMsThrottled(storePlayheadMs);
  const actions = useStudioStore((state) => Object.values(state.document.actions).filter((action) => action.widgetId === widgetId), shallowEqual);
  const { updateWidgetName, applyPropertyClipboard } = useWidgetActions();
  const { setWidgetKeyframes } = useTimelineActions();
  const [tab, setTab] = useState<WidgetInspectorTabId>('basics');
  const [propertyClipboard, setPropertyClipboard] = useState(() => getWidgetPropertyClipboardPayload());

  const definition = useMemo<WidgetDefinition | null>(() => (widget ? getWidgetDefinition(widget.type) : null), [widget]);
  const tabs = useMemo(
    () => (definition && widget ? getWidgetInspectorTabs(definition, widget, state) : EMPTY_TABS),
    [definition, state.document, state.ui.activeVariant, widget],
  );
  const activeTab = tabs.find((item) => item.id === tab) ?? tabs[0] ?? null;
  const behaviorPanelCount = definition && widget ? getWidgetBehaviorPanelCount(definition, widget, state) : 0;
  const sameTypeClipboard = widget && propertyClipboard ? propertyClipboard.widgetType === widget.type : false;

  useEffect(() => {
    if (!tabs.length) return;
    if (!tabs.some((item) => item.id === tab)) {
      setTab(tabs[0].id);
    }
  }, [tab, tabs]);

  useEffect(() => {
    if (!widget || inspectorFocus?.widgetId !== widget.id) return;
    if (inspectorFocus.tab && tabs.some((item) => item.id === inspectorFocus.tab) && inspectorFocus.tab !== tab) {
      setTab(inspectorFocus.tab);
    }
  }, [inspectorFocus, tab, tabs, widget]);

  useEffect(() => subscribeToWidgetPropertyClipboard(() => {
    setPropertyClipboard(getWidgetPropertyClipboardPayload());
  }), []);

  if (!widget || !definition) return <DocumentInspectorPanel />;

  const handleCopyProperties = () => {
    setWidgetPropertyClipboardPayload(buildWidgetPropertyClipboardPayload(widget));
  };

  const handlePasteProperties = () => {
    if (!propertyClipboard) return;
    applyPropertyClipboard(widget.id, propertyClipboard);
    if (!supportsAnimationPresets(widget)) return;
    const nextWidget = {
      ...widget,
      props: propertyClipboard.widgetType === widget.type ? { ...propertyClipboard.props } : widget.props,
      style: propertyClipboard.widgetType === widget.type ? { ...propertyClipboard.style } : { ...widget.style, ...propertyClipboard.style },
      motion: propertyClipboard.widgetType === widget.type ? propertyClipboard.motion : widget.motion,
    };
    const preset = resolveWidgetMotionSelection(nextWidget)?.template.id
      ?? (typeof nextWidget.style.animationPreset === 'string' ? nextWidget.style.animationPreset : '');
    if (!preset) return;
    const { keyframes } = applyAnimationPreset(nextWidget, preset as Parameters<typeof applyAnimationPreset>[1]);
    setWidgetKeyframes(widget.id, keyframes);
  };

  return (
    <>
      <section className="section">
        <label>Name</label>
        <input value={widget.name} onChange={(event) => updateWidgetName(widget.id, event.target.value)} />
        <div className="asset-inline-actions inspector-spaced-stack">
          <Button size="sm" className="left-button compact-action" onClick={handleCopyProperties}>
            Copy properties
          </Button>
          <Button size="sm" className="compact-action" disabled={!propertyClipboard} onClick={handlePasteProperties}>
            Paste properties
          </Button>
        </div>
        {propertyClipboard ? (
          <small className="muted">
            {sameTypeClipboard
              ? `Ready to paste full properties from ${propertyClipboard.widgetName}.`
              : `Ready to paste shared style from ${propertyClipboard.widgetName}. Full module settings only paste into another ${propertyClipboard.widgetType}.`}
          </small>
        ) : null}
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
            const panel = renderWidgetInspectorPanel(panelKey, {
              widget,
              definition,
              state,
              playheadMs,
              actions,
              focusedKeyframeId: inspectorFocus?.widgetId === widget.id ? inspectorFocus.keyframeId : undefined,
            });
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
