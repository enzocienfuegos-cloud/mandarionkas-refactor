import type { SceneNode, VariantName } from '../../../domain/document/types';
import { useSceneActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';

export function ScenesSection(): JSX.Element {
  const { document, activeScene } = useDocumentInspectorContext();
  const { updateScene, addScene, duplicateScene, deleteScene } = useSceneActions();
  if (!activeScene) return <section className="section section-premium"><h3>Scenes</h3><small className="muted">No active scene.</small></section>;

  return (
    <section className="section section-premium">
      <h3>Scenes</h3>
      <div className="field-stack">
        <div className="fields-grid">
          <div><label>Scene name</label><input value={activeScene.name} onChange={(event) => updateScene(activeScene.id, { name: event.target.value })} /></div>
          <div><label>Duration ms</label><input type="number" value={activeScene.durationMs} onChange={(event) => updateScene(activeScene.id, { durationMs: Number(event.target.value) })} /></div>
        </div>
        <div className="fields-grid">
          <div><label>Next scene</label><select value={activeScene.flow?.nextSceneId ?? ''} onChange={(event) => updateScene(activeScene.id, { flow: { ...(activeScene.flow ?? {}), nextSceneId: event.target.value || undefined } })}><option value="">Auto</option>{document.scenes.filter((scene) => scene.id !== activeScene.id).map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></div>
          <div><label>Allowed variants</label><input value={(activeScene.conditions?.variants ?? []).join(',')} onChange={(event) => updateScene(activeScene.id, { conditions: { ...(activeScene.conditions ?? {}), variants: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) as VariantName[] } })} placeholder="default,promo" /></div>
          <div><label>Transition type</label><select value={activeScene.transition?.type ?? 'fade'} onChange={(event) => updateScene(activeScene.id, { transition: { ...(activeScene.transition ?? { durationMs: 450 }), type: event.target.value as 'cut' | 'fade' | 'slide-left' | 'slide-right' } })}><option value="cut">cut</option><option value="fade">fade</option><option value="slide-left">slide-left</option><option value="slide-right">slide-right</option></select></div>
          <div><label>Transition ms</label><input type="number" value={activeScene.transition?.durationMs ?? 450} onChange={(event) => updateScene(activeScene.id, { transition: { ...(activeScene.transition ?? { type: 'fade' }), durationMs: Number(event.target.value) } })} /></div>
        </div>
        <SceneFlowEditor activeScene={activeScene} scenes={document.scenes} />
        <div className="field-stack">
          <button onClick={addScene}>Add scene</button>
          <button onClick={() => duplicateScene(activeScene.id)}>Duplicate scene</button>
          <button onClick={() => deleteScene(activeScene.id)} disabled={document.scenes.length <= 1}>Delete scene</button>
        </div>
      </div>
    </section>
  );
}

type SceneFlowEditorProps = {
  activeScene: SceneNode;
  scenes: SceneNode[];
};

function SceneFlowEditor({ activeScene, scenes }: SceneFlowEditorProps): JSX.Element {
  const { updateScene } = useSceneActions();
  const branches = activeScene.flow?.branches ?? [];

  const updateBranch = (index: number, patch: Record<string, unknown>) => {
    const nextBranches = branches.map((item, branchIndex) => branchIndex === index ? { ...item, ...patch } : item);
    updateScene(activeScene.id, { flow: { ...(activeScene.flow ?? {}), branches: nextBranches } });
  };

  return (
    <div className="field-stack">
      <div className="meta-line"><span className="pill">Branches {branches.length}</span><span className="pill">Widget count {activeScene.widgetIds.length}</span></div>
      {branches.map((branch, index) => (
        <div key={`${branch.targetSceneId}-${index}`} className="fields-grid">
          <div><label>Label</label><input value={branch.label ?? ''} onChange={(event) => updateBranch(index, { label: event.target.value })} /></div>
          <div><label>Source</label><input value={branch.source} onChange={(event) => updateBranch(index, { source: event.target.value })} /></div>
          <div><label>Field</label><input value={branch.field} onChange={(event) => updateBranch(index, { field: event.target.value })} /></div>
          <div><label>Value</label><input value={branch.value} onChange={(event) => updateBranch(index, { value: event.target.value })} /></div>
          <div><label>Target</label><select value={branch.targetSceneId} onChange={(event) => updateBranch(index, { targetSceneId: event.target.value })}>{scenes.filter((scene) => scene.id !== activeScene.id).map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></div>
        </div>
      ))}
      <div className="meta-line">
        <button onClick={() => updateScene(activeScene.id, { flow: { ...(activeScene.flow ?? {}), branches: [...branches, { source: 'custom', field: 'segment', value: 'a', targetSceneId: scenes.find((scene) => scene.id !== activeScene.id)?.id ?? activeScene.id, label: `Branch ${branches.length + 1}` }] } })}>Add branch</button>
      </div>
    </div>
  );
}
