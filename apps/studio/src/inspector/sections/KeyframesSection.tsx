import { useEffect, useRef } from 'react';
import { useTimelineActions, useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Button } from '../../shared/ui/Button';
import { Tile } from '../../shared/ui/Tile';
import { KEYFRAME_PROPERTIES } from './widget-inspector-shared';
import { applyAnimationPreset, getAnimationPresetConfig, supportsAnimationPresets, type SupportedAnimationPreset } from './animation-presets';

export function KeyframesSection({
  widget,
  playheadMs,
  focusedKeyframeId,
}: {
  widget: WidgetNode;
  playheadMs: number;
  focusedKeyframeId?: string;
}): JSX.Element {
  const { addKeyframe, setPlayhead, setWidgetKeyframes, removeKeyframe, updateKeyframe } = useTimelineActions();
  const { updateWidgetStyle } = useWidgetActions();
  const keyframes = widget.timeline.keyframes ?? [];
  const animationConfig = getAnimationPresetConfig(widget);
  const activePreset = animationConfig.preset;
  const focusedKeyframeRef = useRef<HTMLDivElement | null>(null);

  const handleApplyPreset = (preset: SupportedAnimationPreset) => {
    const { keyframes: nextKeyframes, stylePatch } = applyAnimationPreset(widget, preset);
    setWidgetKeyframes(widget.id, nextKeyframes);
    updateWidgetStyle(widget.id, stylePatch);
  };

  const handleAnimationConfigChange = (patch: Record<string, unknown>) => {
    const nextWidget: WidgetNode = { ...widget, style: { ...widget.style, ...patch } };
    updateWidgetStyle(widget.id, patch);
    if (!activePreset) return;
    const { keyframes: nextKeyframes, stylePatch } = applyAnimationPreset(nextWidget, activePreset);
    setWidgetKeyframes(widget.id, nextKeyframes);
    updateWidgetStyle(widget.id, stylePatch);
  };

  const handlePresetSelection = (value: string) => {
    if (value === 'appear' || value === 'fade-up' || value === 'fade-out' || value === 'pulse') {
      handleApplyPreset(value);
      return;
    }
    updateWidgetStyle(widget.id, { animationPreset: '' });
  };

  useEffect(() => {
    if (!focusedKeyframeId || !focusedKeyframeRef.current) return;
    focusedKeyframeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedKeyframeId]);

  return (
    <section className="section section-premium">
      <h3>Keyframes</h3>
      <div className="field-stack">
        {supportsAnimationPresets(widget) ? (
          <Tile>
            <div className="meta-line">
              <span className="pill">Animation template</span>
              {activePreset ? <span className="pill">Active {activePreset}</span> : <span className="pill">No template</span>}
            </div>
            <small className="muted">Choose a motion template and tune it here. Studio writes editable keyframes for you so you only fine-tune when you want to.</small>
            <div className="fields-grid">
              <div>
                <label>Preset</label>
                <select value={activePreset} onChange={(event) => handlePresetSelection(event.target.value)}>
                  <option value="">Custom / none</option>
                  <option value="appear">Appear</option>
                  <option value="fade-up">Fade up</option>
                  <option value="fade-out">Fade out</option>
                  <option value="pulse">Pulse</option>
                </select>
              </div>
              <div>
                <label>Duration ms</label>
                <input
                  type="number"
                  min={120}
                  step={20}
                  value={animationConfig.durationMs}
                  onChange={(event) => handleAnimationConfigChange({ animationDurationMs: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Delay ms</label>
                <input
                  type="number"
                  min={0}
                  step={20}
                  value={animationConfig.delayMs}
                  onChange={(event) => handleAnimationConfigChange({ animationDelayMs: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Repeat</label>
                <select
                  value={animationConfig.repeatMode}
                  onChange={(event) => handleAnimationConfigChange({ animationRepeatMode: event.target.value === 'repeat' ? 'repeat' : 'once' })}
                >
                  <option value="once">Play once</option>
                  <option value="repeat">Repeat</option>
                </select>
              </div>
              <div>
                <label>Distance px</label>
                <input
                  type="number"
                  min={0}
                  step={2}
                  value={animationConfig.distancePx}
                  onChange={(event) => handleAnimationConfigChange({ animationDistancePx: Number(event.target.value) })}
                />
              </div>
              <div>
                <label>Intensity</label>
                <input
                  type="number"
                  min={0.1}
                  max={1}
                  step={0.05}
                  value={animationConfig.intensity}
                  onChange={(event) => handleAnimationConfigChange({ animationIntensity: Number(event.target.value) })}
                />
              </div>
            </div>
            <div className="inline-actions">
              <Button size="sm" onClick={() => handleApplyPreset(activePreset || 'appear')}>{activePreset ? 'Refresh template' : 'Apply template'}</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePresetSelection('')}>Leave as custom</Button>
            </div>
          </Tile>
        ) : null}
        <Tile>
          <div className="meta-line">
            <span className="pill">Playhead {playheadMs}ms</span>
            <span className="pill">Tracks {new Set(keyframes.map((item) => item.property)).size}</span>
            <span className="pill">Total {keyframes.length}</span>
          </div>
          <small className="muted">The timeline is now the primary animation surface. Use the row-level keyframe pills below to jump around, and use this panel to fine-tune exact values.</small>
        </Tile>
        <div className="inline-actions">
          {KEYFRAME_PROPERTIES.map((property) => (
            <Button key={property} size="sm" onClick={() => addKeyframe(widget.id, property, playheadMs)}>+ {property}</Button>
          ))}
        </div>
        {keyframes.map((keyframe) => (
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
