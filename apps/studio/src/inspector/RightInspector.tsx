import { useStudioStore } from '../core/store/use-studio-store';
import { DocumentInspectorPanel } from './panels/DocumentInspectorPanel';
import { MultiSelectionInspectorPanel } from './panels/MultiSelectionInspectorPanel';
import { WidgetInspectorPanel } from './panels/WidgetInspectorPanel';

export function RightInspector({ onToggleCollapse }: { onToggleCollapse: () => void }): JSX.Element {
  const selectionIds = useStudioStore((state) => state.document.selection.widgetIds);
  const documentName = useStudioStore((state) => state.document.name);
  const activeSceneName = useStudioStore((state) => {
    const activeScene = state.document.scenes.find((scene) => scene.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
    return activeScene?.name ?? 'Scene';
  });

  const inspectorTitle = selectionIds.length === 0 ? documentName : selectionIds.length === 1 ? 'Widget properties' : 'Multi-selection';
  const inspectorStateLabel = selectionIds.length === 0 ? 'Document overview' : selectionIds.length === 1 ? 'Single widget selected' : 'Group editing';
  const inspectorHint = selectionIds.length === 0
    ? 'Canvas, scenes, data, release and collaboration live here.'
    : selectionIds.length === 1
      ? 'Core controls stay visible first. Advanced settings are tucked into collapsible groups.'
      : 'Use bulk actions and layer review for the current selection.';

  return (
    <aside className="right-inspector">
      <div className="inspector-shell">
        <div className="inspector-hero">
          <div className="inspector-hero-head">
            <div>
              <small className="muted">Inspector</small>
              <strong>{inspectorTitle}</strong>
            </div>
            <button className="icon-button ghost panel-collapse-button" type="button" title="Hide inspector" aria-label="Hide inspector" onClick={onToggleCollapse}>›</button>
          </div>
          <div className="meta-line">
            <span className="pill">{activeSceneName}</span>
            <span className="pill">{inspectorStateLabel}</span>
          </div>
          <small className="muted inspector-hero-caption">{inspectorHint}</small>
        </div>
        {selectionIds.length === 0 ? (
          <DocumentInspectorPanel />
        ) : selectionIds.length === 1 ? (
          <WidgetInspectorPanel widgetId={selectionIds[0]} />
        ) : (
          <MultiSelectionInspectorPanel widgetIds={selectionIds} />
        )}
      </div>
    </aside>
  );
}
