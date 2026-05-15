import { useTimelineActions, useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Button } from '../../shared/ui/Button';
import { Tile } from '../../shared/ui/Tile';
import { KEYFRAME_PROPERTIES } from './widget-inspector-shared';
import { applyAnimationPreset, supportsAnimationPresets, type SupportedAnimationPreset } from './animation-presets';

export function KeyframesSection({ widget, playheadMs }: { widget: WidgetNode; playheadMs: number }): JSX.Element {
  const { addKeyframe, setPlayhead, setWidgetKeyframes, removeKeyframe, updateKeyframe } = useTimelineActions();
  const { updateWidgetStyle } = useWidgetActions();
  const keyframes = widget.timeline.keyframes ?? [];
  const activePreset = typeof widget.style.animationPreset === 'string' ? widget.style.animationPreset : '';

  const handleApplyPreset = (preset: SupportedAnimationPreset) => {
    const { keyframes: nextKeyframes, stylePatch } = applyAnimationPreset(widget, preset);
    setWidgetKeyframes(widget.id, nextKeyframes);
    updateWidgetStyle(widget.id, stylePatch);
  };

  return (
    <section className="section section-premium">
      <h3>Keyframes</h3>
      <div className="field-stack">
        {supportsAnimationPresets(widget) ? (
          <Tile>
            <div className="meta-line">
              <span className="pill">Animation presets</span>
              {activePreset ? <span className="pill">Active {activePreset}</span> : null}
            </div>
            <small className="muted">Quick presets write timeline keyframes for this widget. You can still fine-tune them below afterward.</small>
            <div className="inline-actions">
              <Button size="sm" onClick={() => handleApplyPreset('appear')}>Appear</Button>
              <Button size="sm" onClick={() => handleApplyPreset('fade-up')}>Fade up</Button>
              <Button size="sm" onClick={() => handleApplyPreset('pulse')}>Pulse</Button>
            </div>
          </Tile>
        ) : null}
        <div className="meta-line"><span className="pill">Playhead {playheadMs}ms</span><span className="pill">Tracks {new Set(keyframes.map((item) => item.property)).size}</span><span className="pill">Total {keyframes.length}</span></div>
        <small className="muted">Easing and markers are now isolated in their own section component, which makes the inspector panel much easier to evolve.</small>
        <div className="inline-actions">
          {KEYFRAME_PROPERTIES.map((property) => (
            <Button key={property} size="sm" onClick={() => addKeyframe(widget.id, property, playheadMs)}>+ {property}</Button>
          ))}
        </div>
        {keyframes.map((keyframe) => (
          <Tile key={keyframe.id}>
            <div className="meta-line">
              <span className="pill">{keyframe.property}</span>
              <Button variant="ghost" size="sm" onClick={() => setPlayhead(keyframe.atMs)}>Go to keyframe</Button>
              <Button variant="ghost" size="sm" onClick={() => removeKeyframe(widget.id, keyframe.id)}>Remove</Button>
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
          </Tile>
        ))}
      </div>
    </section>
  );
}
