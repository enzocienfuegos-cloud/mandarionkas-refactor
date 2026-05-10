import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function DragTokenPoolInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Drag token pool</h3>
      <div className="field-stack">
        <div><label>Tokens JSON</label><textarea rows={8} value={String(node.props.tokens ?? '[]')} onChange={(e) => updateWidgetProps(node.id, { tokens: e.target.value })} /></div>
        <div><label>Disabled ids CSV</label><input value={String(node.props.disabledIds ?? '')} onChange={(e) => updateWidgetProps(node.id, { disabledIds: e.target.value })} /></div>
        <div><label>Drop target id</label><input value={String(node.props.dropTargetId ?? '')} onChange={(e) => updateWidgetProps(node.id, { dropTargetId: e.target.value })} /></div>
        <div><label>Token size</label><input type="number" min={32} max={160} step={4} value={Number(node.props.tokenSize ?? 72)} onChange={(e) => updateWidgetProps(node.id, { tokenSize: Number(e.target.value) })} /></div>
        <div><label>Gap</label><input type="number" min={4} max={60} step={2} value={Number(node.props.gap ?? 16)} onChange={(e) => updateWidgetProps(node.id, { gap: Number(e.target.value) })} /></div>
      </div>
    </section>
  );
}
