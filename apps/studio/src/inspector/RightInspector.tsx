import { useStudioStore } from '../core/store/use-studio-store';
import { DocumentInspectorPanel } from './panels/DocumentInspectorPanel';
import { MultiSelectionInspectorPanel } from './panels/MultiSelectionInspectorPanel';
import { WidgetInspectorPanel } from './panels/WidgetInspectorPanel';
import { IconButton } from '../shared/ui/IconButton';
import { StudioIcon, StudioIcons } from '../shared/ui/icons';

export function RightInspector({
  onToggleCollapse,
  onResizeStart,
}: {
  onToggleCollapse: () => void;
  onResizeStart: (startX: number) => void;
}): JSX.Element {
  const selectionIds = useStudioStore((state) => state.document.selection.widgetIds);
  const documentName = useStudioStore((state) => state.document.name);
  const activeSceneName = useStudioStore((state) => {
    const activeScene = state.document.scenes.find((scene) => scene.id === state.document.selection.activeSceneId) ?? state.document.scenes[0];
    return activeScene?.name ?? 'Scene';
  });

  const inspectorTitle = selectionIds.length === 0 ? (documentName?.trim() || 'Untitled project') : selectionIds.length === 1 ? 'Selected widget' : 'Multi-selection';
  const inspectorEyebrow = selectionIds.length === 0 ? 'Document' : selectionIds.length === 1 ? 'Widget' : 'Selection';

  return (
    <aside className="right-inspector">
      <div
        className="right-inspector-resize-handle"
        onPointerDown={(event) => {
          event.preventDefault();
          onResizeStart(event.clientX);
        }}
        aria-label="Resize inspector"
        role="separator"
        aria-orientation="vertical"
      />
      <div className="inspector-shell">
        <div className="inspector-hero">
          <div className="inspector-hero-head">
            <div className="inspector-hero-title-stack">
              <strong>{inspectorTitle}</strong>
              <small className="muted">{inspectorEyebrow} · {activeSceneName}</small>
            </div>
            <IconButton
              className="panel-collapse-button"
              variant="ghost"
              size="md"
              label="Hide inspector"
              tooltipPlacement="bottom"
              tooltipDelay={240}
              icon={<StudioIcon icon={StudioIcons.chevronRight} size={18} />}
              onClick={onToggleCollapse}
            />
          </div>
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
