import { useStudioStore } from '../../core/store/use-studio-store';
import { getBindingSuggestions } from '../../domain/document/resolvers';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { BindingSource, WidgetNode } from '../../domain/document/types';

export function DataBindingsSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const state = useStudioStore((value) => value);
  const { updateWidgetBinding } = useWidgetActions();
  const bindings = widget.bindings ?? {};
  const rows = [
    { key: 'text', label: 'Text' },
    { key: 'title', label: 'Title' },
    { key: 'price', label: 'Price' },
    { key: 'url', label: 'URL' },
    { key: 'style.backgroundColor', label: 'Style background' },
  ];

  return (
    <section className="section section-premium">
      <h3>Data bindings</h3>
      <div className="field-stack">
        <small className="muted">Bind widget fields to the active feed source without centralizing all widget logic in a giant panel file.</small>
        {rows.map((row) => {
          const binding = bindings[row.key];
          const source = (binding?.source ?? 'product') as BindingSource;
          const suggestions = getBindingSuggestions(source, state);
          return (
            <div key={row.key} style={{ border: '1px solid rgba(255,255,255,.08)', borderRadius: 12, padding: 10 }}>
              <div className="meta-line"><strong>{row.label}</strong>{binding ? <button onClick={() => updateWidgetBinding(widget.id, row.key, undefined)}>Clear</button> : null}</div>
              <div className="fields-grid">
                <div>
                  <label>Source</label>
                  <select value={source} onChange={(event) => updateWidgetBinding(widget.id, row.key, { source: event.target.value as BindingSource, field: suggestions[0] ?? 'title', fallback: '' })}>
                    <option value="product">product</option>
                    <option value="weather">weather</option>
                    <option value="location">location</option>
                    <option value="custom">custom</option>
                  </select>
                </div>
                <div>
                  <label>Field</label>
                  <select value={binding?.field ?? ''} onChange={(event) => updateWidgetBinding(widget.id, row.key, { source, field: event.target.value, fallback: binding?.fallback ?? '' })}>
                    <option value="">Not bound</option>
                    {suggestions.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label>Fallback</label>
                <input value={binding?.fallback ?? ''} onChange={(event) => updateWidgetBinding(widget.id, row.key, { source, field: binding?.field ?? suggestions[0] ?? '', fallback: event.target.value })} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
