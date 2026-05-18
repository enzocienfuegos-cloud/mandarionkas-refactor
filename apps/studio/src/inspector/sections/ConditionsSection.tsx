import { useStudioStoreSnapshot } from '../../core/store/use-studio-store';
import { getBindingSuggestions, getFeedCatalogSources } from '../../domain/document/resolvers';
import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { BindingSource, VariantName, WidgetNode } from '../../domain/document/types';
import { createInspectorField, createInspectorSection } from '../contract-driven';
import { Button } from '../../shared/ui/Button';

export function ConditionsSection({ widget }: { widget: WidgetNode }): JSX.Element {
  const state = useStudioStoreSnapshot();
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

  return createInspectorSection({
    title: 'Conditions',
    description: 'Show a widget only for specific variants, records or feed values.',
    children: (
      <>
        <div>
          <label>Allowed variants</label>
          <div className="inline-actions section-offset-top">
            {(['default', 'promo', 'alternate'] as VariantName[]).map((variant) => (
              <Button key={variant} variant={variants.includes(variant) ? 'primary' : 'ghost'} size="sm" onClick={() => toggleVariant(variant)}>{variant}</Button>
            ))}
          </div>
        </div>
        {createInspectorField({
          kind: 'text',
          label: 'Only for record IDs',
          value: (widget.conditions?.records ?? []).join(', '),
          placeholder: 'product_summer, product_clearance',
          onChange: (value) => updateWidgetConditions(widget.id, { records: value.split(',').map((item) => item.trim()).filter(Boolean) }),
        })}
        <div className="fields-grid">
          {createInspectorField({
            kind: 'select',
            label: 'Rule source',
            value: source,
            onChange: (value) => updateWidgetConditions(widget.id, { equals: { source: value as BindingSource, operator: widget.conditions?.equals?.operator ?? 'equals', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value: widget.conditions?.equals?.value ?? '' } }),
            options: sources.map((item) => ({ label: item, value: item })),
          })}
          {createInspectorField({
            kind: 'select',
            label: 'Operator',
            value: widget.conditions?.equals?.operator ?? 'equals',
            onChange: (value) => updateWidgetConditions(widget.id, { equals: { source, operator: value as 'equals' | 'not-equals' | 'contains' | 'starts-with', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value: widget.conditions?.equals?.value ?? '' } }),
            options: ['equals', 'not-equals', 'contains', 'starts-with'].map((item) => ({ label: item, value: item })),
          })}
          {createInspectorField({
            kind: 'select',
            label: 'Rule field',
            value: widget.conditions?.equals?.field ?? '',
            onChange: (value) => updateWidgetConditions(widget.id, { equals: { source, operator: widget.conditions?.equals?.operator ?? 'equals', field: value, value: widget.conditions?.equals?.value ?? '' } }),
            options: [{ label: 'No rule', value: '' }, ...suggestions.map((item) => ({ label: item, value: item }))],
          })}
          {createInspectorField({
            kind: 'text',
            label: 'Rule value',
            value: widget.conditions?.equals?.value ?? '',
            onChange: (value) => updateWidgetConditions(widget.id, { equals: { source, operator: widget.conditions?.equals?.operator ?? 'equals', field: widget.conditions?.equals?.field ?? suggestions[0] ?? '', value } }),
          })}
        </div>
      </>
    ),
  });
}
