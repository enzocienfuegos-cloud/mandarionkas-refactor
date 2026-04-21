import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function DropZoneInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Drop zone</h3>
      <div className="field-stack">
        <div><label>Width</label><input type="number" min={20} max={400} step={4} value={Number(node.props.width ?? 120)} onChange={(e) => updateWidgetProps(node.id, { width: Number(e.target.value) })} /></div>
        <div><label>Height</label><input type="number" min={20} max={400} step={4} value={Number(node.props.height ?? 120)} onChange={(e) => updateWidgetProps(node.id, { height: Number(e.target.value) })} /></div>
        <div><label>Hit padding</label><input type="number" min={0} max={60} step={2} value={Number(node.props.hitPadding ?? 16)} onChange={(e) => updateWidgetProps(node.id, { hitPadding: Number(e.target.value) })} /></div>
        <div>
          <label>Match action map JSON</label>
          <textarea
            rows={6}
            value={String(node.props.matchActionMap ?? '{}')}
            onChange={(e) => updateWidgetProps(node.id, { matchActionMap: e.target.value })}
          />
        </div>
        <label className="checkbox-row"><input type="checkbox" checked={Boolean(node.props.debugOutline ?? true)} onChange={(e) => updateWidgetProps(node.id, { debugOutline: e.target.checked })} />Show debug outline</label>
      </div>
    </section>
  );
}
