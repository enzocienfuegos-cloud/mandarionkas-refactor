import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function ParticleHaloInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Particle halo</h3>
      <div className="field-stack">
        <div><label>Size</label><input type="number" min={40} max={400} step={4} value={Number(node.props.size ?? 160)} onChange={(e) => updateWidgetProps(node.id, { size: Number(e.target.value) })} /></div>
        <div><label>Radius</label><input type="number" min={12} max={200} step={2} value={Number(node.props.radius ?? 64)} onChange={(e) => updateWidgetProps(node.id, { radius: Number(e.target.value) })} /></div>
        <div><label>Particle count</label><input type="number" min={4} max={32} step={1} value={Number(node.props.count ?? 12)} onChange={(e) => updateWidgetProps(node.id, { count: Number(e.target.value) })} /></div>
        <div><label>Pulse ms</label><input type="number" min={400} max={6000} step={100} value={Number(node.props.pulseMs ?? 1800)} onChange={(e) => updateWidgetProps(node.id, { pulseMs: Number(e.target.value) })} /></div>
        <div><label>Inner color</label><input value={String(node.props.colorA ?? '#ffffff')} onChange={(e) => updateWidgetProps(node.id, { colorA: e.target.value })} /></div>
        <div><label>Outer color</label><input value={String(node.props.colorB ?? '#00c9ff')} onChange={(e) => updateWidgetProps(node.id, { colorB: e.target.value })} /></div>
      </div>
    </section>
  );
}
