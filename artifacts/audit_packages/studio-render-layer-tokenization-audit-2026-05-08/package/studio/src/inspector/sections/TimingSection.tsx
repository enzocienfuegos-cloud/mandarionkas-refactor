import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';

export function TimingSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetTiming } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Timing</h3>
      <div className="fields-grid">
        <div>
          <label>Start ms</label>
          <input type="number" value={widget.timeline.startMs} onChange={(event) => updateWidgetTiming(widget.id, { startMs: Number(event.target.value) })} />
        </div>
        <div>
          <label>End ms</label>
          <input type="number" value={widget.timeline.endMs} onChange={(event) => updateWidgetTiming(widget.id, { endMs: Number(event.target.value) })} />
        </div>
      </div>
    </section>
  );
}
