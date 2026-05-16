import { useEffect, useRef } from 'react';
import { useTimelineActions, useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Button } from '../../shared/ui/Button';
import { Tile } from '../../shared/ui/Tile';
import { MotionConfigFields } from '../../motion/react/MotionConfigFields';
import { MotionTemplateGallery } from '../../motion/react/MotionTemplateGallery';
import { KEYFRAME_PROPERTIES } from './widget-inspector-shared';
import { applyAnimationPreset, getAnimationPresetConfig, getAvailableAnimationTemplates, stripPresetManagedKeyframes, supportsAnimationPresets, type SupportedAnimationPreset } from './animation-presets';
import { buildLegacyMotionStylePatch, buildWidgetMotion } from '../../motion/motion-model';

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
  const { updateWidgetMotion, updateWidgetStyle } = useWidgetActions();
  const animationConfig = getAnimationPresetConfig(widget);
  const activePreset = animationConfig.preset;
  const keyframes = widget.timeline.keyframes ?? [];
  const visibleKeyframes = activePreset ? stripPresetManagedKeyframes(keyframes) : keyframes;
  const focusedKeyframeRef = useRef<HTMLDivElement | null>(null);
  const templates = getAvailableAnimationTemplates(widget);

  const handleApplyPreset = (preset: SupportedAnimationPreset) => {
    const { keyframes: nextKeyframes, stylePatch, motion } = applyAnimationPreset(widget, preset);
    setWidgetKeyframes(widget.id, nextKeyframes);
    updateWidgetMotion(widget.id, motion);
    updateWidgetStyle(widget.id, stylePatch);
  };

  const handleAnimationConfigChange = (patch: Record<string, unknown>) => {
    if (!activePreset) return;
    const nextMotion = buildWidgetMotion(activePreset, {
      ...(widget.motion?.config ?? {}),
      ...(patch as Record<string, number | string>),
    });
    updateWidgetMotion(widget.id, nextMotion);
    updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(nextMotion));
  };

  const handlePresetSelection = (value: string | null) => {
    if (templates.some((template) => template.id === value)) {
      handleApplyPreset(value as SupportedAnimationPreset);
      return;
    }
    setWidgetKeyframes(widget.id, stripPresetManagedKeyframes(widget.timeline.keyframes ?? []));
    updateWidgetMotion(widget.id, undefined);
    updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(undefined));
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
              <span className="pill">Motion template</span>
              {activePreset ? <span className="pill">Active {activePreset}</span> : <span className="pill">No template</span>}
            </div>
            <small className="muted">Choose one motion template per widget. Entrance and loop motion now live in a dedicated slot instead of fabricating extra timeline tracks.</small>
            <MotionTemplateGallery
              templates={templates}
              selectedTemplateId={activePreset || null}
              configByTemplateId={activePreset ? { [activePreset]: widget.motion?.config ?? {} } : undefined}
              onSelect={handlePresetSelection}
            />
            {activePreset && widget.motion && templates.some((template) => template.id === activePreset) ? (
              <MotionConfigFields
                template={templates.find((template) => template.id === activePreset)!}
                config={widget.motion.config}
                onChange={handleAnimationConfigChange}
              />
            ) : null}
            <div className="inline-actions">
              <Button size="sm" onClick={() => handleApplyPreset((activePreset || 'appear') as SupportedAnimationPreset)}>{activePreset ? 'Re-apply template' : 'Apply template'}</Button>
              <Button size="sm" variant="ghost" onClick={() => handlePresetSelection('')}>Clear template</Button>
            </div>
          </Tile>
        ) : null}
        <Tile>
          <div className="meta-line">
            <span className="pill">Playhead {playheadMs}ms</span>
            <span className="pill">Tracks {new Set(visibleKeyframes.map((item) => item.property)).size}</span>
            <span className="pill">Total {visibleKeyframes.length}</span>
          </div>
          <small className="muted">
            {activePreset
              ? 'This widget is using a single restricted animation template. Switch the preset to Custom / none if you want to edit manual keyframes.'
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
