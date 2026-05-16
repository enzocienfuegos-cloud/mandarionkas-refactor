import { useEffect, useRef } from 'react';
import { useTimelineActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { stripMotionManagedKeyframes } from '../../motion/motion-managed-keyframes';
import { Button } from '../../shared/ui/Button';
import { Tile } from '../../shared/ui/Tile';
import { KEYFRAME_PROPERTIES } from './widget-inspector-shared';
import { getAnimationPresetConfig } from './animation-presets';

export function KeyframesSection({
  widget,
  playheadMs,
  focusedKeyframeId,
}: {
  widget: WidgetNode;
  playheadMs: number;
  focusedKeyframeId?: string;
}): JSX.Element {
  const { addKeyframe, setPlayhead, removeKeyframe, updateKeyframe } = useTimelineActions();
  const animationConfig = getAnimationPresetConfig(widget);
  const activePreset = animationConfig.preset;
  const keyframes = widget.timeline.keyframes ?? [];
  const visibleKeyframes = activePreset ? stripMotionManagedKeyframes(keyframes) : keyframes;
  const focusedKeyframeRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!focusedKeyframeId || !focusedKeyframeRef.current) return;
    focusedKeyframeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedKeyframeId]);

  return (
    <section className="section section-premium">
      <h3>Keyframes</h3>
      <div className="field-stack">
        <Tile>
          <div className="meta-line">
            <span className="pill">Playhead {playheadMs}ms</span>
            <span className="pill">Tracks {new Set(visibleKeyframes.map((item) => item.property)).size}</span>
            <span className="pill">Total {visibleKeyframes.length}</span>
          </div>
          <small className="muted">
            {activePreset
              ? 'This widget is using a motion template. Manual keyframes here stay focused on timeline-driven properties rather than preset motion.'
              : 'The timeline is now the primary animation surface. Use the row-level keyframe pills below to jump around, and use this panel to fine-tune exact values.'}
          </small>
        </Tile>
        {!activePreset ? (
          <div className="inline-actions">
            {KEYFRAME_PROPERTIES.map((property) => (
              <Button key={property} size="sm" onClick={() => addKeyframe(widget.id, property, playheadMs)}>+ {property}</Button>
            ))}
          </div>
        ) : null}
        {visibleKeyframes.map((keyframe) => (
          <Tile
            key={keyframe.id}
            ref={keyframe.id === focusedKeyframeId ? focusedKeyframeRef : undefined}
            className={keyframe.id === focusedKeyframeId ? 'is-focused-keyframe' : undefined}
          >
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
