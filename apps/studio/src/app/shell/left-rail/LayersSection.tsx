import type { LeftRailController } from './use-left-rail-controller';

export function LayersSection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { widgetActions, selectedIds, nodes } = controller;
  const selectedWidgets = selectedIds.map((widgetId) => nodes[widgetId]).filter(Boolean);

  return (
    <>
      <div className="left-title" style={{ marginTop: 8 }}>Layer actions</div>
      <div className="field-stack rail-action-grid" style={{ marginBottom: 12 }}>
        <button className="left-button compact-action" onClick={() => widgetActions.groupSelected()} disabled={selectedIds.length < 2}>Group</button>
        <button className="left-button compact-action" onClick={() => widgetActions.ungroupSelected()} disabled={!selectedIds.length}>Ungroup</button>
      </div>

      <div className="left-card left-card--section" style={{ display: 'grid', gap: 10 }}>
        <div className="meta-line" style={{ justifyContent: 'space-between' }}>
          <strong>Timeline owns layers</strong>
          <span className="pill">{selectedIds.length} selected</span>
        </div>
        <small className="muted">Show, hide, lock, rename, and reorder layers now happen directly in the timeline track header.</small>
        {selectedWidgets.length ? (
          <div className="field-stack" style={{ gap: 8 }}>
            {selectedWidgets.map((widget) => (
              <div key={widget.id} className="layer-row compact">
                <div className="layer-meta">
                  <strong>{widget.name}</strong>
                  <small className="muted">{widget.hidden ? 'Hidden' : 'Visible'} · {widget.locked ? 'Locked' : 'Unlocked'}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <small className="muted">Select one or more layers on the canvas or in the timeline to group them here.</small>
        )}
      </div>
    </>
  );
}
