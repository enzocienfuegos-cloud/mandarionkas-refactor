import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';

export function PositionSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const { updateWidgetFrame } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>Position and size</h3>
      <div className="fields-grid">
        {([
          ['X', 'x'],
          ['Y', 'y'],
          ['W', 'width'],
          ['H', 'height'],
        ] as const).map(([label, key]) => (
          <div key={key}>
            <label>{label}</label>
            <input type="number" value={Math.round(widget.frame[key])} onChange={(event) => updateWidgetFrame(widget.id, { [key]: Number(event.target.value) })} />
          </div>
        ))}
      </div>
    </section>
  );
}
