import { useWidgetActions } from '../../hooks/use-studio-actions';

export function WidgetUtilitiesSection(): JSX.Element {
  const { groupSelected, ungroupSelected, duplicateSelected, deleteSelected } = useWidgetActions();

  return (
    <section className="section section-premium">
      <div className="field-stack">
        <button onClick={groupSelected}>Group</button>
        <button onClick={ungroupSelected}>Ungroup</button>
        <button onClick={duplicateSelected}>Duplicate</button>
        <button onClick={deleteSelected}>Delete</button>
      </div>
    </section>
  );
}
