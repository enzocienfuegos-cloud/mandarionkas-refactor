import { useWidgetActions } from '../../hooks/use-studio-actions';
import { shallowEqual, useStudioStore } from '../../core/store/use-studio-store';
import { Button } from '../../shared/ui/Button';

export function WidgetUtilitiesSection(): JSX.Element {
  const { groupSelected, ungroupSelected, convertWidgetToSharedLayer, duplicateSelected, deleteSelected } = useWidgetActions();
  const { selectedWidget, sceneCount } = useStudioStore((state) => {
    const selectedId = state.document.selection.primaryWidgetId;
    return {
      selectedWidget: selectedId ? state.document.widgets[selectedId] : undefined,
      sceneCount: state.document.scenes.length,
    };
  }, shallowEqual);
  const canConvertToSharedLayer = Boolean(selectedWidget && !selectedWidget.sharedLayerId && !selectedWidget.parentId && !(selectedWidget.childIds?.length) && sceneCount > 1);

  return (
    <section className="section section-premium">
      <div className="field-stack">
        <Button onClick={groupSelected}>Group</Button>
        <Button onClick={ungroupSelected}>Ungroup</Button>
        <Button onClick={() => selectedWidget && convertWidgetToSharedLayer(selectedWidget.id)} disabled={!canConvertToSharedLayer}>
          Convert to shared layer
        </Button>
        <Button onClick={duplicateSelected}>Duplicate</Button>
        <Button variant="danger" onClick={deleteSelected}>Delete</Button>
      </div>
    </section>
  );
}
