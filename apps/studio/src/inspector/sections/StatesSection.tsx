import { ColorControl } from '../../shared/ui/ColorControl';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { Tile } from '../../shared/ui/Tile';
import { getHoverMotionConfig } from './animation-presets';

export function StatesSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetStyle } = useWidgetActions();
  const hoverMotion = getHoverMotionConfig(widget);

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
          <div className="fields-grid">
            <div>
              <label>Preset</label>
              <select value={hoverMotion.preset} onChange={(event) => updateWidgetStyle(widget.id, { hoverMotionPreset: event.target.value })}>
                <option value="none">None</option>
                <option value="lift">Lift</option>
                <option value="zoom">Zoom</option>
                <option value="pulse">Pulse</option>
              </select>
            </div>
            <div>
              <label>Duration ms</label>
              <input type="number" min={120} step={20} value={hoverMotion.durationMs} onChange={(event) => updateWidgetStyle(widget.id, { hoverMotionDurationMs: Number(event.target.value) })} />
            </div>
            <div>
              <label>Lift px</label>
              <input type="number" min={0} step={2} value={hoverMotion.distancePx} onChange={(event) => updateWidgetStyle(widget.id, { hoverMotionDistancePx: Number(event.target.value) })} />
            </div>
            <div>
              <label>Scale</label>
              <input type="number" min={1} max={1.4} step={0.01} value={hoverMotion.scale} onChange={(event) => updateWidgetStyle(widget.id, { hoverMotionScale: Number(event.target.value) })} />
            </div>
          </div>
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
