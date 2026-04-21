import { useDocumentActions } from '../../../hooks/use-studio-actions';
import { useDocumentInspectorContext } from './document-inspector-shared';

export function StoryInfoSection(): JSX.Element {
  const { document, playheadMs, activeVariant, activeScene, nextSceneId, lastAction } = useDocumentInspectorContext();
  const { updateName } = useDocumentActions();

  return (
    <section className="section section-premium">
      <h3>Story info</h3>
      <div className="field-stack">
        <div>
          <label>Name</label>
          <input value={document.name} onChange={(event) => updateName(event.target.value)} />
        </div>
        <div className="meta-line"><span className="pill">Playhead {playheadMs}ms</span><span className="pill">Variant: {activeVariant}</span></div>
        <div className="meta-line"><span className="pill">Active: {activeScene?.name ?? 'Scene'}</span><span className="pill">Next: {document.scenes.find((scene) => scene.id === nextSceneId)?.name ?? 'End'}</span></div>
        {lastAction ? <div className="pill">Last action: {lastAction}</div> : null}
      </div>
    </section>
  );
}
