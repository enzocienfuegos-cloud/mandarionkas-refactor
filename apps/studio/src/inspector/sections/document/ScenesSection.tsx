import { useState } from 'react';
import type { SceneNode, VariantName } from '../../../domain/document/types';
import { useSceneActions } from '../../../hooks/use-studio-actions';
import { Button } from '../../../shared/ui/Button';
import { useDocumentInspectorContext } from './document-inspector-shared';

const TRANSITION_TYPES = ['cut', 'fade', 'slide-left', 'slide-right'] as const;
type TransitionType = typeof TRANSITION_TYPES[number];

export function ScenesSection(): JSX.Element {
  const { document, activeScene } = useDocumentInspectorContext();
  const { updateScene, addScene, addSceneFromCurrent, duplicateScene, deleteScene, selectScene, reorderScenes } = useSceneActions();
  if (!activeScene) return <section className="section section-premium"><h3>Scenes</h3><small className="muted">No active scene.</small></section>;
  const orderedScenes = [...document.scenes].sort((left, right) => left.order - right.order);

  return (
    <section className="section section-premium">
      <h3>Scenes</h3>
      <div className="field-stack">
        <SceneList
          scenes={orderedScenes}
          activeSceneId={activeScene.id}
          onSelect={selectScene}
          onReorder={reorderScenes}
          onUpdateTransition={(sceneId, transition) => updateScene(sceneId, { transition })}
          onUpdateDuration={(sceneId, durationMs) => updateScene(sceneId, { durationMs })}
          onUpdateName={(sceneId, name) => updateScene(sceneId, { name })}
          onDelete={deleteScene}
          canDelete={orderedScenes.length > 1}
        />
        <div className="fields-grid">
          <div><label>Next scene</label><select value={activeScene.flow?.nextSceneId ?? ''} onChange={(event) => updateScene(activeScene.id, { flow: { ...(activeScene.flow ?? {}), nextSceneId: event.target.value || undefined } })}><option value="">Auto</option>{orderedScenes.filter((scene) => scene.id !== activeScene.id).map((scene) => <option key={scene.id} value={scene.id}>{scene.name}</option>)}</select></div>
          <div><label>Allowed variants</label><input value={(activeScene.conditions?.variants ?? []).join(',')} onChange={(event) => updateScene(activeScene.id, { conditions: { ...(activeScene.conditions ?? {}), variants: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) as VariantName[] } })} placeholder="default,promo" /></div>
        </div>
        <ActiveSceneFlowEditor scene={activeScene} scenes={orderedScenes} />
        <div className="field-stack">
          <Button onClick={addScene}>New scene (empty)</Button>
          <Button onClick={addSceneFromCurrent}>New scene (inherit layers)</Button>
          <Button onClick={() => duplicateScene(activeScene.id)}>Duplicate scene</Button>
          <Button variant="danger" onClick={() => deleteScene(activeScene.id)} disabled={document.scenes.length <= 1}>Delete scene</Button>
        </div>
      </div>
    </section>
  );
}

type SceneListProps = {
  scenes: SceneNode[];
  activeSceneId: string;
  onSelect: (sceneId: string) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onUpdateTransition: (sceneId: string, transition: SceneNode['transition']) => void;
  onUpdateDuration: (sceneId: string, durationMs: number) => void;
  onUpdateName: (sceneId: string, name: string) => void;
  onDelete: (sceneId: string) => void;
  canDelete: boolean;
};

function SceneList({
  scenes,
  activeSceneId,
  onSelect,
  onReorder,
  onUpdateTransition,
  onUpdateDuration,
  onUpdateName,
  onDelete,
  canDelete,
}: SceneListProps): JSX.Element {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  return (
    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {scenes.map((scene, index) => {
        const isActive = scene.id === activeSceneId;
        const isDropTarget = dragOverIndex === index && draggedIndex !== null && draggedIndex !== index;
        return (
          <li
            key={scene.id}
            draggable
            onDragStart={(event) => {
              setDraggedIndex(index);
              event.dataTransfer.effectAllowed = 'move';
            }}
            onDragEnd={() => {
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setDragOverIndex(index);
            }}
            onDragLeave={() => setDragOverIndex(null)}
            onDrop={(event) => {
              event.preventDefault();
              if (draggedIndex !== null && draggedIndex !== index) onReorder(draggedIndex, index);
              setDraggedIndex(null);
              setDragOverIndex(null);
            }}
            style={{
              display: 'grid',
              gridTemplateColumns: 'auto minmax(0, 1fr) minmax(220px, auto) auto',
              gap: 8,
              alignItems: 'center',
              padding: '8px 10px',
              border: `1px ${isDropTarget ? 'dashed' : 'solid'} ${isActive || isDropTarget ? 'var(--accent-color)' : 'var(--border-subtle)'}`,
              borderRadius: 8,
              background: 'var(--surface-card)',
              cursor: 'grab',
            }}
          >
            <span aria-hidden="true" style={{ color: 'var(--text-muted)', userSelect: 'none' }}>⋮⋮</span>
            <div style={{ display: 'grid', gap: 6 }}>
              <button type="button" className="button-unstyled" onClick={() => onSelect(scene.id)} style={{ textAlign: 'left', fontWeight: 600 }}>
                {index + 1}. {scene.name}
              </button>
              <input value={scene.name} onChange={(event) => onUpdateName(scene.id, event.target.value)} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'end' }}>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Transition</span>
                <select
                  value={scene.transition?.type ?? 'fade'}
                  onChange={(event) => onUpdateTransition(scene.id, { ...(scene.transition ?? { durationMs: 450 }), type: event.target.value as TransitionType })}
                >
                  {TRANSITION_TYPES.map((transitionType) => (
                    <option key={transitionType} value={transitionType}>{transitionType}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Transition ms</span>
                <input
                  type="number"
                  min={0}
                  value={scene.transition?.durationMs ?? 450}
                  onChange={(event) => onUpdateTransition(scene.id, { ...(scene.transition ?? { type: 'fade' }), durationMs: Number(event.target.value) })}
                />
              </label>
              <label style={{ display: 'grid', gap: 4 }}>
                <span>Duration ms</span>
                <input
                  type="number"
                  min={0}
                  value={scene.durationMs}
                  onChange={(event) => onUpdateDuration(scene.id, Number(event.target.value))}
                />
              </label>
            </div>
            <Button variant="danger" size="sm" onClick={() => onDelete(scene.id)} disabled={!canDelete}>×</Button>
          </li>
        );
      })}
    </ul>
  );
}

type ActiveSceneFlowEditorProps = {
  scene: SceneNode;
  scenes: SceneNode[];
};

function ActiveSceneFlowEditor({ scene, scenes }: ActiveSceneFlowEditorProps): JSX.Element {
  const { updateScene } = useSceneActions();
  const branches = scene.flow?.branches ?? [];

  const updateBranch = (index: number, patch: Record<string, unknown>) => {
    const nextBranches = branches.map((item, branchIndex) => branchIndex === index ? { ...item, ...patch } : item);
    updateScene(scene.id, { flow: { ...(scene.flow ?? {}), branches: nextBranches } });
  };

  return (
    <div className="field-stack">
      <div className="meta-line"><span className="pill">Branches {branches.length}</span><span className="pill">Widget count {scene.widgetIds.length}</span></div>
      {branches.map((branch, index) => (
        <div key={`${branch.targetSceneId}-${index}`} className="fields-grid">
          <div><label>Label</label><input value={branch.label ?? ''} onChange={(event) => updateBranch(index, { label: event.target.value })} /></div>
          <div><label>Source</label><input value={branch.source} onChange={(event) => updateBranch(index, { source: event.target.value })} /></div>
          <div><label>Field</label><input value={branch.field} onChange={(event) => updateBranch(index, { field: event.target.value })} /></div>
          <div><label>Value</label><input value={branch.value} onChange={(event) => updateBranch(index, { value: event.target.value })} /></div>
          <div><label>Target</label><select value={branch.targetSceneId} onChange={(event) => updateBranch(index, { targetSceneId: event.target.value })}>{scenes.filter((candidate) => candidate.id !== scene.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select></div>
        </div>
      ))}
      <div className="meta-line">
        <Button size="sm" onClick={() => updateScene(scene.id, { flow: { ...(scene.flow ?? {}), branches: [...branches, { source: 'custom', field: 'segment', value: 'a', targetSceneId: scenes.find((candidate) => candidate.id !== scene.id)?.id ?? scene.id, label: `Branch ${branches.length + 1}` }] } })}>Add branch</Button>
      </div>
    </div>
  );
}
