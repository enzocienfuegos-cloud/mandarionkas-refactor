import { useWidgetActions } from '../../hooks/use-studio-actions';
import { shallowEqual, useStudioStore } from '../../core/store/use-studio-store';
import { Button } from '../../shared/ui/Button';
import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';

export function MultiSelectionInspectorPanel({ widgetIds }: { widgetIds: string[] }): JSX.Element {
  const widgets = useStudioStore((state) => {
    const widgetsById = buildResolvedWidgetsById(state.document);
    return widgetIds.map((id) => widgetsById[id]).filter(Boolean);
  }, shallowEqual);
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
          <Button onClick={groupSelected}>Group selection</Button>
          <Button onClick={ungroupSelected}>Ungroup selection</Button>
          <Button onClick={duplicateSelected}>Duplicate selection</Button>
          <Button variant="danger" onClick={deleteSelected}>Delete selection</Button>
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
