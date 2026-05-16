import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { buildLegacyHoverMotionStylePatch, buildLegacyMotionStylePatch, buildWidgetHoverMotion, buildWidgetMotion } from '../../motion/motion-model';
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
  const supportsEntranceMotion = supportsAnimationPresets(widget);
  const supportsHoverMotion = supportsHoverPresets(widget);

  if (!supportsEntranceMotion && !supportsHoverMotion) return null;

  const animationConfig = getAnimationPresetConfig(widget);
  const hoverConfig = getHoverMotionConfig(widget);
  const entranceTemplates = getAvailableAnimationTemplates(widget);
  const hoverTemplates = getAvailableHoverTemplates(widget);
  const activeEntranceTemplate = animationConfig.preset
    ? entranceTemplates.find((template) => template.id === animationConfig.preset)
    : undefined;
  const activeHoverTemplate = hoverConfig.preset !== 'none'
    ? hoverTemplates.find((template) => template.id === hoverConfig.preset)
    : undefined;

  return (
    <section className="section section-premium">
      <h3>Motion</h3>
      <div className="field-stack">
        {supportsEntranceMotion ? (
          <Tile>
            <div className="meta-line">
              <span className="pill">Entrance / loop</span>
              {animationConfig.preset ? <span className="pill">Active {animationConfig.preset}</span> : <span className="pill">No template</span>}
            </div>
            <small className="muted">Choose one motion template per widget. This slot is exclusive: one element, one entrance or loop animation.</small>
            <MotionTemplateGallery
              templates={entranceTemplates}
              selectedTemplateId={animationConfig.preset || null}
              configByTemplateId={widget.motion?.templateId ? { [widget.motion.templateId]: widget.motion.config } : undefined}
              onSelect={(templateId) => {
                if (!templateId) {
                  updateWidgetMotion(widget.id, undefined);
                  updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(undefined));
                  return;
                }
                const { stylePatch, motion } = applyAnimationPreset(widget, templateId as Parameters<typeof applyAnimationPreset>[1]);
                updateWidgetMotion(widget.id, motion);
                updateWidgetStyle(widget.id, stylePatch);
              }}
              emptyLabel="No motion template"
            />
            {activeEntranceTemplate && widget.motion ? (
              <MotionConfigFields
                template={activeEntranceTemplate}
                config={widget.motion.config}
                onChange={(patch) => {
                  const nextMotion = buildWidgetMotion(activeEntranceTemplate.id, { ...widget.motion?.config, ...patch });
                  updateWidgetMotion(widget.id, nextMotion);
                  updateWidgetStyle(widget.id, buildLegacyMotionStylePatch(nextMotion));
                }}
              />
            ) : null}
          </Tile>
        ) : null}

        {supportsHoverMotion ? (
          <Tile>
            <div className="meta-line">
              <span className="pill">Hover motion</span>
              {hoverConfig.preset !== 'none' ? <span className="pill">Active {hoverConfig.preset}</span> : <span className="pill">Static</span>}
            </div>
            <small className="muted">Use hover motion for lightweight emphasis without building timeline tracks.</small>
            <MotionTemplateGallery
              templates={hoverTemplates}
              selectedTemplateId={hoverConfig.preset !== 'none' ? hoverConfig.preset : null}
              configByTemplateId={widget.hoverMotion?.templateId ? { [widget.hoverMotion.templateId]: widget.hoverMotion.config } : undefined}
              onSelect={(templateId) => {
                const { hoverMotion: nextHoverMotion, stylePatch } = buildHoverMotionPreset(widget, (templateId ?? 'none') as 'none' | 'lift' | 'zoom' | 'pulse');
                updateWidgetHoverMotion(widget.id, nextHoverMotion);
                updateWidgetStyle(widget.id, stylePatch);
              }}
              emptyLabel="No hover motion"
            />
            {activeHoverTemplate && widget.hoverMotion ? (
              <MotionConfigFields
                template={activeHoverTemplate}
                config={widget.hoverMotion.config}
                onChange={(patch) => {
                  const nextHoverMotion = buildWidgetHoverMotion(activeHoverTemplate.id, { ...widget.hoverMotion?.config, ...patch });
                  updateWidgetHoverMotion(widget.id, nextHoverMotion);
                  updateWidgetStyle(widget.id, buildLegacyHoverMotionStylePatch(nextHoverMotion));
                }}
              />
            ) : null}
          </Tile>
        ) : null}
      </div>
    </section>
  );
}
