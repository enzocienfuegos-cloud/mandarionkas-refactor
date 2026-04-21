import { useTimelineActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { KEYFRAME_PROPERTIES } from './widget-inspector-shared';

export function KeyframesSection({ widget, playheadMs }: { widget: WidgetNode; playheadMs: number }): JSX.Element {
  const { addKeyframe, setPlayhead, removeKeyframe, updateKeyframe } = useTimelineActions();
  const keyframes = widget.timeline.keyframes ?? [];

  return (
    <section className="section section-premium">
      <h3>Keyframes</h3>
      <div className="field-stack">
        <div className="meta-line"><span className="pill">Playhead {playheadMs}ms</span><span className="pill">Tracks {new Set(keyframes.map((item) => item.property)).size}</span><span className="pill">Total {keyframes.length}</span></div>
        <small className="muted">Easing and markers are now isolated in their own section component, which makes the inspector panel much easier to evolve.</small>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {KEYFRAME_PROPERTIES.map((property) => (
            <button key={property} onClick={() => addKeyframe(widget.id, property, playheadMs)}>+ {property}</button>
          ))}
        </div>
        {keyframes.map((keyframe) => (
          <div key={keyframe.id} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 10 }}>
            <div className="meta-line">
              <span className="pill">{keyframe.property}</span>
              <button onClick={() => setPlayhead(keyframe.atMs)}>Go to keyframe</button>
              <button onClick={() => removeKeyframe(widget.id, keyframe.id)}>Remove</button>
            </div>
            <div className="fields-grid">
              <div>
                <label>At ms</label>
                <input type="number" value={keyframe.atMs} onChange={(event) => updateKeyframe(widget.id, keyframe.id, { atMs: Number(event.target.value) })} />
              </div>
              <div>
                <label>Value</label>
                <input type="number" value={keyframe.value} onChange={(event) => updateKeyframe(widget.id, keyframe.id, { value: Number(event.target.value) })} />
              </div>
              <div>
                <label>Easing</label>
                <select value={keyframe.easing ?? 'linear'} onChange={(event) => updateKeyframe(widget.id, keyframe.id, { easing: event.target.value as 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' })}>
                  <option value="linear">linear</option>
                  <option value="ease-in">ease-in</option>
                  <option value="ease-out">ease-out</option>
                  <option value="ease-in-out">ease-in-out</option>
                </select>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
