import type { LeftRailController } from './use-left-rail-controller';

export function StoryFlowSection({ controller }: { controller: LeftRailController }): JSX.Element {
  const { scenes, activeSceneId, sceneActions } = controller;

  return (
    <>
      <div className="left-rail-section-head" style={{ marginTop: 8 }}>
        <div>
          <div className="left-title">Story flow</div>
          <strong className="rail-heading">Scenes</strong>
        </div>
        <div className="layer-actions">
          <button className="ghost icon-button" title="Add scene" onClick={() => sceneActions.addScene()}>＋</button>
          <button className="ghost icon-button" title="Duplicate scene" onClick={() => sceneActions.duplicateScene(activeSceneId)}>⧉</button>
          <button className="ghost icon-button" title="Delete scene" onClick={() => sceneActions.deleteScene(activeSceneId)} disabled={scenes.length <= 1}>🗑</button>
        </div>
      </div>
      <div className="field-stack" style={{ marginBottom: 8 }}>
        {scenes.map((item, index) => {
          const nextName = scenes.find((sceneItem) => sceneItem.id === item.flow?.nextSceneId)?.name ?? 'Auto / End';
          const branches = item.flow?.branches ?? (item.flow?.branchEquals ? [item.flow.branchEquals] : []);
          const active = item.id === activeSceneId;
          return (
            <button key={item.id} className={`left-button ${active ? 'is-active' : ''}`} onClick={() => sceneActions.selectScene(item.id)}>
              <div className="meta-line" style={{ alignItems: 'center' }}>
                <strong>{index + 1}. {item.name}</strong>
                <span className="pill">{item.durationMs}ms</span>
              </div>
              <small className="muted">Next: {nextName}</small>
              {branches.length ? <div style={{ marginTop: 6, display: 'grid', gap: 4 }}>{branches.slice(0, 3).map((branch, branchIndex) => <small className="muted" key={`${item.id}-${branchIndex}`}>↳ {branch.label || `${branch.field} ${(branch.operator ?? 'equals')} ${branch.value}`} → {scenes.find((sceneItem) => sceneItem.id === branch.targetSceneId)?.name ?? 'Unknown'}</small>)}{branches.length > 3 ? <small className="muted">+{branches.length - 3} more branches</small> : null}</div> : null}
            </button>
          );
        })}
      </div>
    </>
  );
}
