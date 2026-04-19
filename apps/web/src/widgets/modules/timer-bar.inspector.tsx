import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function TimerBarInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Timer bar</h3>
      <div className="field-stack">
        <div><label>Duration ms</label><input type="number" min={1000} max={60000} step={500} value={Number(node.props.durationMs ?? 7000)} onChange={(e) => updateWidgetProps(node.id, { durationMs: Number(e.target.value) })} /></div>
        <div><label>Orientation</label><select value={String(node.props.orientation ?? 'horizontal')} onChange={(e) => updateWidgetProps(node.id, { orientation: e.target.value })}><option value="horizontal">Horizontal</option><option value="vertical">Vertical</option></select></div>
        <div><label>Thickness</label><input type="number" min={2} max={40} step={1} value={Number(node.props.thickness ?? 8)} onChange={(e) => updateWidgetProps(node.id, { thickness: Number(e.target.value) })} /></div>
        <div><label>Fill color</label><input value={String(node.props.fillColor ?? '#00e5ff')} onChange={(e) => updateWidgetProps(node.id, { fillColor: e.target.value })} /></div>
        <div><label>Track color</label><input value={String(node.props.trackColor ?? 'rgba(255,255,255,0.2)')} onChange={(e) => updateWidgetProps(node.id, { trackColor: e.target.value })} /></div>
        <div><label>Corner radius</label><input type="number" min={0} max={20} step={1} value={Number(node.props.borderRadius ?? 4)} onChange={(e) => updateWidgetProps(node.id, { borderRadius: Number(e.target.value) })} /></div>
      </div>
    </section>
  );
}
