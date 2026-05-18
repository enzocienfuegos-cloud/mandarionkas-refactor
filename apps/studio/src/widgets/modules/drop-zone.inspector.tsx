import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import { useStudioStore } from '../../core/store/use-studio-store';

export function DropZoneInspector({ node }: { node: WidgetNode }): JSX.Element {
  const { updateWidgetFrame, updateWidgetProps } = useWidgetActions();
  const sceneWidgets = useStudioStore((state) => Object.values(state.document.widgets).filter((widget) => widget.sceneId === node.sceneId && widget.id !== node.id));
  const anchorWidgetId = String(node.props.anchorWidgetId ?? '').trim();
  const activeAnchorWidget = sceneWidgets.find((widget) => widget.id === anchorWidgetId);

  const attachToWidget = (widgetId: string) => {
    const targetWidget = sceneWidgets.find((widget) => widget.id === widgetId);
    if (!targetWidget) {
      updateWidgetProps(node.id, { anchorWidgetId: undefined });
      return;
    }
    updateWidgetProps(node.id, { anchorWidgetId: targetWidget.id });
    updateWidgetFrame(node.id, {
      x: targetWidget.frame.x,
      y: targetWidget.frame.y,
      width: targetWidget.frame.width,
      height: targetWidget.frame.height,
    });
  };

  return (
    <section className="section section-premium">
      <h3>Drag area</h3>
      <div className="field-stack">
        <div>
          <label>Attached widget</label>
          <select value={anchorWidgetId} onChange={(event) => attachToWidget(event.target.value)}>
            <option value="">Manual area</option>
            {sceneWidgets.map((widget) => (
              <option key={widget.id} value={widget.id}>
                {widget.name || `${widget.type} ${widget.id.slice(0, 6)}`}
              </option>
            ))}
          </select>
        </div>
        <div className="meta-line">
          {activeAnchorWidget
            ? `This drag trigger area follows "${activeAnchorWidget.name || activeAnchorWidget.type}" when that widget moves or resizes.`
            : 'This drag trigger area is manual. Attach it to a widget if you want the trigger surface to follow that layer automatically.'}
        </div>
        <div className="fields-grid">
          <div><label>X</label><input type="number" step={1} value={Number(node.frame.x ?? 0)} onChange={(e) => updateWidgetFrame(node.id, { x: Number(e.target.value) })} /></div>
          <div><label>Y</label><input type="number" step={1} value={Number(node.frame.y ?? 0)} onChange={(e) => updateWidgetFrame(node.id, { y: Number(e.target.value) })} /></div>
          <div><label>Width</label><input type="number" min={20} max={400} step={4} value={Number(node.frame.width ?? node.props.width ?? 120)} onChange={(e) => updateWidgetFrame(node.id, { width: Number(e.target.value) })} /></div>
          <div><label>Height</label><input type="number" min={20} max={400} step={4} value={Number(node.frame.height ?? node.props.height ?? 120)} onChange={(e) => updateWidgetFrame(node.id, { height: Number(e.target.value) })} /></div>
          <div><label>Hit padding</label><input type="number" min={0} max={60} step={2} value={Number(node.props.hitPadding ?? 16)} onChange={(e) => updateWidgetProps(node.id, { hitPadding: Number(e.target.value) })} /></div>
        </div>
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
