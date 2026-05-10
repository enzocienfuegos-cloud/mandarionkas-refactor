import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function StepIndicatorInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Step indicator</h3>
      <div className="field-stack">
        <div><label>Total steps</label><input type="number" min={1} max={10} step={1} value={Number(node.props.total ?? 3)} onChange={(e) => updateWidgetProps(node.id, { total: Number(e.target.value) })} /></div>
        <div><label>Completed steps</label><input type="number" min={0} max={10} step={1} value={Number(node.props.current ?? 1)} onChange={(e) => updateWidgetProps(node.id, { current: Number(e.target.value) })} /></div>
        <div><label>Dot size</label><input type="number" min={4} max={40} step={1} value={Number(node.props.size ?? 10)} onChange={(e) => updateWidgetProps(node.id, { size: Number(e.target.value) })} /></div>
        <div><label>Gap</label><input type="number" min={2} max={40} step={1} value={Number(node.props.gap ?? 10)} onChange={(e) => updateWidgetProps(node.id, { gap: Number(e.target.value) })} /></div>
        <div><label>Done color</label><input value={String(node.props.doneColor ?? '#ffffff')} onChange={(e) => updateWidgetProps(node.id, { doneColor: e.target.value })} /></div>
        <div><label>Pending color</label><input value={String(node.props.pendingColor ?? 'rgba(255,255,255,0.3)')} onChange={(e) => updateWidgetProps(node.id, { pendingColor: e.target.value })} /></div>
      </div>
    </section>
  );
}
