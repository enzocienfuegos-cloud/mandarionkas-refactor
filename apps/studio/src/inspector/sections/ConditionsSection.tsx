import { useStudioStore } from '../../core/store/use-studio-store';
import { getBindingSuggestions, getFeedCatalogSources } from '../../domain/document/resolvers';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { BindingSource, VariantName, WidgetNode } from '../../domain/document/types';

export function ConditionsSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const state = useStudioStore((value) => value);
  const { updateWidgetConditions } = useWidgetActions();
  const activeFeedSource = state.ui.activeFeedSource;
  const source = (widget.conditions?.equals?.source ?? activeFeedSource) as BindingSource;
  const suggestions = getBindingSuggestions(source, state);
  const variants = (widget.conditions?.variants ?? []) as VariantName[];
  const sources = getFeedCatalogSources(state);

  const toggleVariant = (variant: VariantName) => {
    const next = variants.includes(variant) ? variants.filter((item) => item !== variant) : [...variants, variant];
    updateWidgetConditions(widget.id, { variants: next });
  };

  return (
    <section className="section section-premium">
      <h3>Conditions</h3>
      <div className="field-stack">
        <small className="muted">Show a widget only for specific variants, records or feed values.</small>
        <div>
          <label>Allowed variants</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
            {(['default', 'promo', 'alternate'] as VariantName[]).map((variant) => (
              <button key={variant} type="button" className={variants.includes(variant) ? 'primary' : 'ghost'} onClick={() => toggleVariant(variant)}>{variant}</button>
            ))}
          </div>
        </div>
        <div>
          <label>Only for record IDs</label>
          <input value={(widget.conditions?.records ?? []).join(', ')} onChange={(event) => updateWidgetConditions(widget.id, { records: event.target.value.split(',').map((item) => item.trim()).filter(Boolean) })} placeholder="product_summer, product_clearance" />
        </div>
        <div className="fields-grid">
          <div>
            <label>Rule source</label>
            <select value={source} onChange={(event) => updateWidgetConditions(widget.id, { equals: { source: event.target.value as BindingSource, operator: widget.conditions?.equals?.operator ?? 'equals', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value: widget.conditions?.equals?.value ?? '' } })}>
              {sources.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label>Operator</label>
            <select value={widget.conditions?.equals?.operator ?? 'equals'} onChange={(event) => updateWidgetConditions(widget.id, { equals: { source, operator: event.target.value as 'equals' | 'not-equals' | 'contains' | 'starts-with', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value: widget.conditions?.equals?.value ?? '' } })}>
              <option value="equals">equals</option>
              <option value="not-equals">not-equals</option>
              <option value="contains">contains</option>
              <option value="starts-with">starts-with</option>
            </select>
          </div>
          <div>
            <label>Rule field</label>
            <select value={widget.conditions?.equals?.field ?? ''} onChange={(event) => updateWidgetConditions(widget.id, { equals: { source, operator: widget.conditions?.equals?.operator ?? 'equals', field: event.target.value, value: widget.conditions?.equals?.value ?? '' } })}>
              <option value="">No rule</option>
              {suggestions.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div>
            <label>Rule value</label>
            <input value={widget.conditions?.equals?.value ?? ''} onChange={(event) => updateWidgetConditions(widget.id, { equals: { source, operator: widget.conditions?.equals?.operator ?? 'equals', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value: event.target.value } })} />
          </div>
        </div>
      </div>
    </section>
  );
}
