import { useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';

export function MultiSelectionInspectorPanel({ widgetIds }: { widgetIds: string[] }): JSX.Element {
  const widgets = useStudioStore((state) => widgetIds.map((id) => state.document.widgets[id]).filter(Boolean));
  const { groupSelected, ungroupSelected, duplicateSelected, deleteSelected } = useWidgetActions();

  return (
    <>
      <section className="section section-premium inspector-summary-card">
        <div className="section-heading-row">
          <div>
            <h3>Multi-selection</h3>
            <small className="muted">Bulk actions stay visible first. Layer review is tucked just below.</small>
          </div>
          <div className="meta-line"><span className="pill">{widgets.length} widgets</span></div>
        </div>
      </section>
      <section className="section section-premium">
        <h3>Selection actions</h3>
        <div className="fields-grid inspector-action-grid">
          <button onClick={groupSelected}>Group selection</button>
          <button onClick={ungroupSelected}>Ungroup selection</button>
          <button onClick={duplicateSelected}>Duplicate selection</button>
          <button onClick={deleteSelected}>Delete selection</button>
        </div>
      </section>
      <section className="section section-premium">
        <h3>Selected layers</h3>
        <div className="field-stack">
          {widgets.map((widget) => (
            <div key={widget.id} className="pill">{widget.name}</div>
          ))}
        </div>
      </section>
    </>
  );
}
