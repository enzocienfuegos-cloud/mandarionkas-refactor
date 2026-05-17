import type { WidgetNode } from '../../domain/document/types';
import { useTimelineActions, useWidgetActions } from '../../hooks/use-studio-actions';
import {
  buildLegacyHoverMotionStylePatch,
  buildLegacyMotionStylePatch,
  buildWidgetHoverMotion,
  buildWidgetMotion,
  resolveWidgetMotionSelection,
} from '../../motion/motion-model';
import { rebuildWidgetMotionKeyframes } from '../../motion/motion-template-keyframes';
import { MotionConfigFields } from '../../motion/react/MotionConfigFields';
import { MotionTemplateGallery } from '../../motion/react/MotionTemplateGallery';
import { Tile } from '../../shared/ui/Tile';
import {
  applyAnimationPreset,
  buildHoverMotionPreset,
  getAvailableAnimationTemplates,
  getAvailableHoverTemplates,
  getAnimationPresetConfig,
  getHoverMotionConfig,
  supportsAnimationPresets,
  supportsHoverPresets,
} from './animation-presets';

export function MotionSection({ widget }: { widget: WidgetNode }): JSX.Element | null {
  const { updateWidgetMotion, updateWidgetHoverMotion, updateWidgetStyle } = useWidgetActions();
  const { setWidgetKeyframes } = useTimelineActions();
  const supportsEntranceMotion = supportsAnimationPresets(widget);
  const supportsHoverMotion = supportsHoverPresets(widget);

  if (!supportsEntranceMotion && !supportsHoverMotion) return null;

  const animationConfig = getAnimationPresetConfig(widget);
  const hoverConfig = getHoverMotionConfig(widget);
  const entranceTemplates = getAvailableAnimationTemplates(widget);
  const hoverTemplates = getAvailableHoverTemplates(widget);
  const selectedMotion = resolveWidgetMotionSelection(widget);

  return (
    <section className="section section-premium">
      <h3>Motion</h3>
      <div className="field-stack motion-section-stack">
        {supportsEntranceMotion ? (
          <Tile className="motion-panel-card">
            <div className="motion-panel-card__header">
              <div>
                <strong>Entrance / loop</strong>
                <small className="muted">Choose one template for this element.</small>
              </div>
              <span className="pill">{animationConfig.preset ? `Active ${animationConfig.preset}` : 'Static'}</span>
            </div>
            <MotionTemplateGallery
              templates={entranceTemplates}
              selectedTemplateId={animationConfig.preset || null}
              configByTemplateId={selectedMotion ? { [selectedMotion.template.id]: selectedMotion.config } : undefined}
              onSelect={(templateId) => {
                if (!templateId) {
                  setWidgetKeyframes(widget.id, rebuildWidgetMotionKeyframes(widget, undefined, widget.timeline.keyframes ?? []));
                  updateWidgetMotion(widget.id, undefined);
                  updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(undefined));
                  return;
                }
                const { keyframes, stylePatch, motion } = applyAnimationPreset(widget, templateId as Parameters<typeof applyAnimationPreset>[1]);
                setWidgetKeyframes(widget.id, keyframes);
                updateWidgetMotion(widget.id, motion);
                updateWidgetStyle(widget.id, stylePatch);
              }}
              emptyLabel="No motion"
              renderSelectedContent={(template) => selectedMotion ? (
                <MotionConfigFields
                  template={template}
                  config={selectedMotion.config}
                  onChange={(patch) => {
                    const nextSlotMotion = buildWidgetMotion(template.id, { ...selectedMotion.config, ...patch }, {
                      trigger: selectedMotion.trigger,
                      replayPolicy: selectedMotion.replayPolicy,
                      phase: selectedMotion.phase,
                    });
                    const nextMotion = nextSlotMotion
                      ? { ...(widget.motion ?? {}), [selectedMotion.phase]: nextSlotMotion[selectedMotion.phase] }
                      : undefined;
                    setWidgetKeyframes(widget.id, rebuildWidgetMotionKeyframes(widget, nextMotion, widget.timeline.keyframes ?? []));
                    updateWidgetMotion(widget.id, nextMotion);
                    updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(nextMotion));
                  }}
                />
              ) : null}
            />
          </Tile>
        ) : null}

        {supportsHoverMotion ? (
          <Tile className="motion-panel-card">
            <div className="motion-panel-card__header">
              <div>
                <strong>Hover</strong>
                <small className="muted">Lightweight hover motion without timeline setup.</small>
              </div>
              <span className="pill">{hoverConfig.preset !== 'none' ? `Active ${hoverConfig.preset}` : 'Static'}</span>
            </div>
            <MotionTemplateGallery
              templates={hoverTemplates}
              selectedTemplateId={hoverConfig.preset !== 'none' ? hoverConfig.preset : null}
              configByTemplateId={widget.hoverMotion?.templateId ? { [widget.hoverMotion.templateId]: widget.hoverMotion.config } : undefined}
              onSelect={(templateId) => {
                const { hoverMotion: nextHoverMotion, stylePatch } = buildHoverMotionPreset(widget, (templateId ?? 'none') as 'none' | 'lift' | 'zoom' | 'pulse');
                updateWidgetHoverMotion(widget.id, nextHoverMotion);
                updateWidgetStyle(widget.id, stylePatch);
              }}
              emptyLabel="No hover"
              renderSelectedContent={(template) => widget.hoverMotion ? (
                <MotionConfigFields
                  template={template}
                  config={widget.hoverMotion.config}
                  onChange={(patch) => {
                    const nextHoverMotion = buildWidgetHoverMotion(template.id, { ...widget.hoverMotion?.config, ...patch });
                    updateWidgetHoverMotion(widget.id, nextHoverMotion);
                    updateWidgetStyle(widget.id, buildLegacyHoverMotionStylePatch(nextHoverMotion));
                  }}
                />
              ) : null}
            />
          </Tile>
        ) : null}
      </div>
    </section>
  );
}
