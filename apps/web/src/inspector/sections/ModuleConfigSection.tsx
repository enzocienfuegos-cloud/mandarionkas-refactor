import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { GENERIC_EXCLUDED_PROP_KEYS, toLabel } from './widget-inspector-shared';

export function ModuleConfigSection({ widget }: { widget: WidgetNode }): JSX.Element | null {
  const { updateWidgetProps } = useWidgetActions();
  const propEntries = Object.entries(widget.props).filter(([key]) => !GENERIC_EXCLUDED_PROP_KEYS.has(key));
  if (!propEntries.length) return null;

  return (
    <section className="section section-premium">
      <h3>Module config</h3>
      <div className="field-stack">
        {propEntries.map(([key, value]) => {
          if (typeof value === 'boolean') {
            return (
              <label className="checkbox-row" key={key}>
                <input type="checkbox" checked={value} onChange={(event) => updateWidgetProps(widget.id, { [key]: event.target.checked })} />
                {toLabel(key)}
              </label>
            );
          }

          return (
            <div key={key}>
              <label>{toLabel(key)}</label>
              <input type={typeof value === 'number' ? 'number' : 'text'} step={typeof value === 'number' ? '1' : undefined} value={String(value)} onChange={(event) => updateWidgetProps(widget.id, { [key]: typeof value === 'number' ? Number(event.target.value) : event.target.value })} />
            </div>
          );
        })}
      </div>
    </section>
  );
}
