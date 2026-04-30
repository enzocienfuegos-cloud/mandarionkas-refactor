import { ColorControl } from '../../shared/ui/ColorControl';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';

export function StatesSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetStyle } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>States</h3>
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
      <small className="muted">Hover and active states now support picker + selectable RGB values for faster styling.</small>
    </section>
  );
}
