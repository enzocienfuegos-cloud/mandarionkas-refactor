import { useStudioStore } from '../../core/store/use-studio-store';
import { useWidgetBehaviorActions } from '../../hooks/use-studio-actions';
import type { ActionNode, WidgetNode } from '../../domain/document/types';
import { ACTION_TYPES } from './widget-inspector-shared';

const ACTION_TRIGGERS: ActionNode['trigger'][] = [
  'click',
  'hover',
  'hover-enter',
  'hover-exit',
  'timeline-enter',
  'timeline-exit',
  'video-play',
  'video-pause',
  'video-ended',
  'video-mute',
  'video-unmute',
  'vast-impression',
  'vast-quartile-25',
  'vast-quartile-50',
  'vast-quartile-75',
  'vast-complete',
  'vast-skip',
  'vast-click',
  'vast-error',
];

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
                  {ACTION_TRIGGERS.map((trigger) => <option key={trigger} value={trigger}>{trigger}</option>)}
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
            {action.type === 'open-url' ? <div className="fields-grid">
              <div><label>URL</label><input value={action.url ?? ''} onChange={(event) => updateWidgetAction(action.id, { url: event.target.value })} /></div>
              <div>
                <label>Target</label>
                <select value={action.target ?? '_blank'} onChange={(event) => updateWidgetAction(action.id, { target: event.target.value as '_blank' | '_self' })}>
                  <option value="_blank">_blank</option>
                  <option value="_self">_self</option>
                </select>
              </div>
            </div> : null}
            {action.type === 'seek-video' ? <div><label>Seek to (seconds)</label><input type="number" min={0} step={0.1} value={Number(action.toSeconds ?? 0)} onChange={(event) => updateWidgetAction(action.id, { toSeconds: Number(event.target.value) })} /></div> : null}
            {(action.type === 'show-overlay' || action.type === 'hide-overlay') ? <div><label>Overlay ID</label><input value={action.overlayId ?? ''} onChange={(event) => updateWidgetAction(action.id, { overlayId: event.target.value })} /></div> : null}
            {action.type === 'fire-tracking-url' ? <div><label>Tracking URLs</label><textarea rows={3} value={(action.urls ?? []).join('\n')} onChange={(event) => updateWidgetAction(action.id, { urls: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean) })} placeholder={'https://tracker-1\nhttps://tracker-2'} /></div> : null}
            {action.type === 'emit-analytics-event' ? <div className="field-stack">
              <div><label>Event name</label><input value={action.eventName ?? ''} onChange={(event) => updateWidgetAction(action.id, { eventName: event.target.value })} /></div>
              <small className="muted">Metadata stays data-driven for now and can be added later without blocking the action.</small>
            </div> : null}
            {action.type !== 'open-url'
              && action.type !== 'go-to-scene'
              && action.type !== 'seek-video'
              && action.type !== 'show-overlay'
              && action.type !== 'hide-overlay'
              && action.type !== 'fire-tracking-url'
              && action.type !== 'emit-analytics-event'
              && !['play-video', 'pause-video', 'mute-video', 'unmute-video'].includes(action.type) ? <div>
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
