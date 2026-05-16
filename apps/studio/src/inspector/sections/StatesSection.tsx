import { ColorControl } from '../../shared/ui/ColorControl';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Tile } from '../../shared/ui/Tile';
import { MotionConfigFields } from '../../motion/react/MotionConfigFields';
import { MotionTemplateGallery } from '../../motion/react/MotionTemplateGallery';
import { buildLegacyHoverMotionStylePatch, buildWidgetHoverMotion } from '../../motion/motion-model';
import { buildHoverMotionPreset, getAvailableHoverTemplates, getHoverMotionConfig } from './animation-presets';

export function StatesSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetHoverMotion, updateWidgetStyle } = useWidgetActions();
  const hoverMotion = getHoverMotionConfig(widget);
  const hoverTemplates = getAvailableHoverTemplates(widget);
  const activeHoverTemplate = widget.hoverMotion?.templateId ? hoverTemplates.find((template) => template.id === widget.hoverMotion?.templateId) : undefined;

  return (
    <section className="section section-premium">
      <h3>States</h3>
      <div className="field-stack">
        <Tile>
          <div className="meta-line">
            <span className="pill">Hover motion</span>
            {hoverMotion.preset !== 'none' ? <span className="pill">Active {hoverMotion.preset}</span> : <span className="pill">Static</span>}
          </div>
          <small className="muted">Use this for quick hover movement without building a timeline. Great for CTA, text and image emphasis in preview and publish.</small>
          <MotionTemplateGallery
            templates={hoverTemplates}
            selectedTemplateId={hoverMotion.preset !== 'none' ? hoverMotion.preset : null}
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
      </div>
      <div className="fields-grid">
        <ColorControl label="Hover background" value={String(widget.style.hoverBackgroundColor ?? '')} fallback={String(widget.style.backgroundColor ?? '#1f2937')} onChange={(value) => updateWidgetStyle(widget.id, { hoverBackgroundColor: value })} />
        <ColorControl label="Hover text" value={String(widget.style.hoverColor ?? '')} fallback={String(widget.style.color ?? '#ffffff')} onChange={(value) => updateWidgetStyle(widget.id, { hoverColor: value })} />
        <ColorControl label="Hover border" value={String(widget.style.hoverBorderColor ?? '')} fallback={String(widget.style.accentColor ?? '#f59e0b')} onChange={(value) => updateWidgetStyle(widget.id, { hoverBorderColor: value })} />
        <div><label>Hover opacity</label><input type="number" step="0.05" min={0} max={1} value={Number(widget.style.hoverOpacity ?? 1)} onChange={(event) => updateWidgetStyle(widget.id, { hoverOpacity: Number(event.target.value) })} /></div>
        <ColorControl label="Active background" value={String(widget.style.activeBackgroundColor ?? '')} fallback={String(widget.style.backgroundColor ?? '#1f2937')} onChange={(value) => updateWidgetStyle(widget.id, { activeBackgroundColor: value })} />
        <ColorControl label="Active text" value={String(widget.style.activeColor ?? '')} fallback={String(widget.style.color ?? '#ffffff')} onChange={(value) => updateWidgetStyle(widget.id, { activeColor: value })} />
        <ColorControl label="Active border" value={String(widget.style.activeBorderColor ?? '')} fallback={String(widget.style.accentColor ?? '#f59e0b')} onChange={(value) => updateWidgetStyle(widget.id, { activeBorderColor: value })} />
        <div><label>Active opacity</label><input type="number" step="0.05" min={0} max={1} value={Number(widget.style.activeOpacity ?? 1)} onChange={(event) => updateWidgetStyle(widget.id, { activeOpacity: Number(event.target.value) })} /></div>
      </div>
      <small className="muted">Hover and active states now support both styling and quick motion templates for faster iteration.</small>
    </section>
  );
}
