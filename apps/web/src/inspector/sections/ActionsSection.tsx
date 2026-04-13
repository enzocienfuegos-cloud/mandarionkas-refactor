import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetBehaviorActions } from '../../hooks/use-studio-actions';
import type { ActionNode, WidgetNode } from '../../domain/document/types';
import { ACTION_TYPES } from './widget-inspector-shared';

export function ActionsSection({ widget, actions }: { widget: WidgetNode; actions: ActionNode[] }): JSX.Element {
  const allWidgets = useStudioStore((state) => Object.values(state.document.widgets));
  const scenes = useStudioStore((state) => state.document.scenes);
  const activeSceneId = useStudioStore((state) => state.document.selection.activeSceneId);
  const { addWidgetAction, updateWidgetAction, executeAction, removeWidgetAction } = useWidgetBehaviorActions();

  return (
    <section className="section section-premium">
      <h3>Actions</h3>
      <div className="field-stack">
        <button onClick={() => addWidgetAction(widget.id)}>Add action</button>
        {!actions.length ? <small className="muted">No actions yet. Add click, hover or timeline-enter behavior here.</small> : null}
        {actions.map((action) => (
          <div key={action.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 10 }}>
            <div className="fields-grid">
              <div>
                <label>Trigger</label>
                <select value={action.trigger} onChange={(event) => updateWidgetAction(action.id, { trigger: event.target.value as ActionNode['trigger'] })}>
                  <option value="click">click</option>
                  <option value="hover">hover</option>
                  <option value="timeline-enter">timeline-enter</option>
                </select>
              </div>
              <div>
                <label>Type</label>
                <select value={action.type} onChange={(event) => updateWidgetAction(action.id, { type: event.target.value as ActionNode['type'] })}>
                  {ACTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label>Label</label>
              <input value={action.label ?? ''} onChange={(event) => updateWidgetAction(action.id, { label: event.target.value })} />
            </div>
            {action.type === 'open-url' ? <div><label>URL</label><input value={action.url ?? ''} onChange={(event) => updateWidgetAction(action.id, { url: event.target.value })} /></div> : null}
            {action.type !== 'open-url' && action.type !== 'go-to-scene' ? <div>
              <label>Target widget</label>
              <select value={action.targetWidgetId ?? ''} onChange={(event) => updateWidgetAction(action.id, { targetWidgetId: event.target.value || undefined })}>
                <option value="">Select target</option>
                {allWidgets.filter((item) => item.id !== widget.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div> : null}
            {action.type === 'set-text' ? <div><label>Text value</label><input value={action.text ?? ''} onChange={(event) => updateWidgetAction(action.id, { text: event.target.value })} /></div> : null}
            {action.type === 'go-to-scene' ? <div>
              <label>Target scene</label>
              <select value={action.targetSceneId ?? ''} onChange={(event) => updateWidgetAction(action.id, { targetSceneId: event.target.value || undefined })}>
                <option value="">Auto next scene</option>
                {scenes.map((scene) => <option key={scene.id} value={scene.id}>{scene.name}{scene.id === activeSceneId ? ' (current)' : ''}</option>)}
              </select>
            </div> : null}
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={() => executeAction(action.id)}>Test action</button>
              <button onClick={() => removeWidgetAction(action.id)}>Remove</button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
