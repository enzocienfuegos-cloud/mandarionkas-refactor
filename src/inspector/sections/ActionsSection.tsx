import { useEffect, useRef } from 'react';
import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetBehaviorActions } from '../../hooks/use-studio-actions';
import { getWidgetActionTargetOptions } from '../../domain/document/action-targets';
import type { ActionNode, WidgetNode } from '../../domain/document/types';
import { ACTION_TYPES } from './widget-inspector-shared';

export function ActionsSection({ widget, actions }: { widget: WidgetNode; actions: ActionNode[] }): JSX.Element {
  const allWidgets = useStudioStore((state) => Object.values(state.document.widgets));
  const scenes = useStudioStore((state) => state.document.scenes);
  const activeSceneId = useStudioStore((state) => state.document.selection.activeSceneId);
  const activeActionId = useStudioStore((state) => state.ui.activeActionId);
  const { addWidgetAction, setActiveAction, updateWidgetAction, executeAction, removeWidgetAction } = useWidgetBehaviorActions();
  const targetOptions = getWidgetActionTargetOptions(widget);
  const unusedTargetOptions = targetOptions.filter((option) => !actions.some((action) => action.targetKey === option.value));
  const assignedTargetOptions = targetOptions.filter((option) => actions.some((action) => action.targetKey === option.value));
  const actionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!activeActionId) return;
    const element = actionRefs.current[activeActionId];
    if (!element) return;
    element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeActionId, actions.length]);

  return (
    <section className="section section-premium">
      <h3>Actions</h3>
      <div className="field-stack">
        <button onClick={() => addWidgetAction(widget.id)}>Add action</button>
        {targetOptions.length ? (
          <div className="field-stack">
            <small className="muted">Target coverage</small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {assignedTargetOptions.map((option) => (
                <div key={option.value} className="pill" style={{ borderColor: 'rgba(34,197,94,.35)' }}>
                  assigned · {option.label}
                </div>
              ))}
              {unusedTargetOptions.map((option) => (
                <div key={option.value} className="pill" style={{ borderColor: 'rgba(245,158,11,.45)' }}>
                  open · {option.label}
                </div>
              ))}
              {!targetOptions.length ? <div className="pill">Whole-widget actions only</div> : null}
            </div>
          </div>
        ) : null}
        {unusedTargetOptions.length ? (
          <div className="field-stack">
            <small className="muted">Quick add target actions</small>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {unusedTargetOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => addWidgetAction(widget.id, {
                    targetKey: option.value,
                    label: option.label,
                    type: 'open-url',
                    trigger: 'click',
                  })}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {!actions.length ? <small className="muted">No actions yet. Add click, hover or timeline-enter behavior here.</small> : null}
        {actions.map((action) => (
          <div
            key={action.id}
            ref={(element) => {
              actionRefs.current[action.id] = element;
            }}
            style={{
              border: activeActionId === action.id ? '1px solid rgba(245,165,36,.45)' : '1px solid rgba(255,255,255,.08)',
              borderRadius: 12,
              padding: 10,
              boxShadow: activeActionId === action.id ? '0 0 0 1px rgba(245,165,36,.16)' : 'none',
            }}
          >
            <div className="fields-grid">
              <div>
                <label>Trigger</label>
                <select value={action.trigger} onChange={(event) => { setActiveAction(action.id); updateWidgetAction(action.id, { trigger: event.target.value as ActionNode['trigger'] }); }}>
                  <option value="click">click</option>
                  <option value="hover">hover</option>
                  <option value="timeline-enter">timeline-enter</option>
                </select>
              </div>
              <div>
                <label>Type</label>
                <select value={action.type} onChange={(event) => { setActiveAction(action.id); updateWidgetAction(action.id, { type: event.target.value as ActionNode['type'] }); }}>
                  {ACTION_TYPES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label>Label</label>
              <input value={action.label ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { label: event.target.value })} />
            </div>
            {targetOptions.length ? <div>
              <label>Target area</label>
              <select value={action.targetKey ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { targetKey: event.target.value || undefined })}>
                <option value="">Whole widget</option>
                {targetOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
            </div> : null}
            {action.type === 'open-url' ? <div><label>URL</label><input autoFocus={activeActionId === action.id} value={action.url ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { url: event.target.value })} /></div> : null}
            {action.type !== 'open-url' && action.type !== 'go-to-scene' ? <div>
              <label>Target widget</label>
              <select value={action.targetWidgetId ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { targetWidgetId: event.target.value || undefined })}>
                <option value="">Select target</option>
                {allWidgets.filter((item) => item.id !== widget.id).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div> : null}
            {action.type === 'set-text' ? <div><label>Text value</label><input value={action.text ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { text: event.target.value })} /></div> : null}
            {action.type === 'go-to-scene' ? <div>
              <label>Target scene</label>
              <select value={action.targetSceneId ?? ''} onFocus={() => setActiveAction(action.id)} onChange={(event) => updateWidgetAction(action.id, { targetSceneId: event.target.value || undefined })}>
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
