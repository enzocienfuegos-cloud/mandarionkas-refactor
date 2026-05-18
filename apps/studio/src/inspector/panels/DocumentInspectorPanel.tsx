import { useEffect, useMemo } from 'react';
import { shallowEqual, useStudioStore, useStudioStoreSnapshot } from '../../core/store/use-studio-store';
import {
  getDocumentInspectorPanelsForTab,
  getDocumentInspectorTabs,
} from '../document-inspector-registry';
import { useDocumentInspectorTab } from '../sections/document/document-inspector-shared';
import { Tabs, type TabDefinition } from '../../shared/ui/Tabs';

export function DocumentInspectorPanel(): JSX.Element {
  const state = useStudioStoreSnapshot();
  const stateVersion = useStudioStore((current) => ({
    document: current.document,
    inspectorFocus: current.ui.inspectorFocus,
    playheadMs: current.ui.playheadMs,
    isPlaying: current.ui.isPlaying,
    activeVariant: current.ui.activeVariant,
    activeFeedSource: current.ui.activeFeedSource,
    activeFeedRecordId: current.ui.activeFeedRecordId,
  }), shallowEqual);
  const tabs = useMemo(() => getDocumentInspectorTabs(state), [stateVersion]);
  const [activeId, setActiveId] = useDocumentInspectorTab(tabs[0]?.id ?? 'overview');

  const activeTab = tabs.find((tab) => tab.id === activeId) ?? tabs[0];
  const tabDefinitions = useMemo<TabDefinition<string>[]>(
    () => tabs.map((tab) => ({ id: tab.id, label: tab.label })),
    [tabs],
  );
  const panels = useMemo(
    () => (activeTab ? getDocumentInspectorPanelsForTab(activeTab, state) : []),
    [activeTab, stateVersion],
  );

  useEffect(() => {
    if (!tabs.length) return;
    if (!activeTab) setActiveId(tabs[0].id);
  }, [activeTab, activeId, setActiveId, tabs]);

  if (!tabs.length || !activeTab) {
    return (
      <div className="inspector-empty-state">
        <small className="muted">Document inspector is not available for this project state yet.</small>
      </div>
    );
  }

  return (
    <>
      <Tabs
        tabs={tabDefinitions}
        activeId={activeTab.id}
        onChange={setActiveId}
        ariaLabel="Document inspector sections"
        idBase="document-inspector"
        className="inspector-tabs"
      />

      <section
        role="tabpanel"
        id={`document-inspector-panel-${activeTab.id}`}
        aria-labelledby={`document-inspector-tab-${activeTab.id}`}
      >
        {panels.map((panel) => {
          const PanelComponent = panel.Component;
          return (
            <details key={panel.key} className="inspector-accordion" open={panel.defaultOpen}>
              <summary>
                <span>{panel.title}</span>
                {panel.subtitle ? <small>{panel.subtitle}</small> : null}
              </summary>
              <div className="inspector-accordion-body">
                <PanelComponent />
              </div>
            </details>
          );
        })}
      </section>
    </>
  );
}
