import type { WidgetNode } from '../../domain/document/types';
import { useWidgetActions } from '../../hooks/use-studio-actions';

export function GroupInspector({ widget }: { widget: WidgetNode }): JSX.Element {
  const widgetActions = useWidgetActions();
  const scratchEnabled = Boolean(widget.props.scratchEnabled);

  return (
    <section className="section section-premium">
      <h3>Group</h3>
      <div className="field-stack">
        <div>
          <label>Title</label>
          <input value={String(widget.props.title ?? '')} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { title: event.target.value })} />
        </div>
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={scratchEnabled}
            onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchEnabled: event.target.checked })}
          />
          Enable scratch cover from grouped layers
        </label>
        {scratchEnabled ? (
          <>
            <div>
              <label>Cover blur</label>
              <input type="number" step="1" value={String(widget.props.coverBlur ?? 0)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { coverBlur: Number(event.target.value) })} />
            </div>
            <div>
              <label>Scratch radius</label>
              <input type="number" step="1" value={String(widget.props.scratchRadius ?? 22)} onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchRadius: Number(event.target.value) })} />
            </div>
            <div>
              <label>Auto reveal %</label>
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                value={String(widget.props.autoRevealThresholdPercent ?? 10)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { autoRevealThresholdPercent: Number(event.target.value) })}
              />
            </div>
            <div>
              <label>Extra activation delay ms</label>
              <input
                type="number"
                step="50"
                min="0"
                value={String(widget.props.scratchActivationDelayMs ?? 0)}
                onChange={(event) => widgetActions.updateWidgetProps(widget.id, { scratchActivationDelayMs: Number(event.target.value) })}
              />
            </div>
            <small className="muted">
              The grouped child layers become the scratchable cover. Scratch waits for the group and its child motions to settle, then adds this extra delay before the cover becomes scratchable.
            </small>
          </>
        ) : null}
      </div>
    </section>
  );
}
