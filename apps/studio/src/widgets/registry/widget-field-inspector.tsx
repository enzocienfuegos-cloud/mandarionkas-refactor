import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { toLabel } from '../../inspector/sections/widget-inspector-shared';
import type { WidgetFieldSpec } from './widget-definition';

export function WidgetFieldInspectorSection({ widget, title = 'Widget settings', fields }: { widget: WidgetNode; title?: string; fields: WidgetFieldSpec[] }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return (
    <section className="section section-premium">
      <h3>{title}</h3>
      <div className="field-stack">
        {fields.map((field) => {
          const value = widget.props[field.key];
          const label = field.label ?? toLabel(field.key);
          const type = field.type ?? (typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text');

          if (type === 'checkbox') {
            return (
              <label className="checkbox-row" key={field.key}>
                <input
                  type="checkbox"
                  checked={Boolean(value)}
                  onChange={(event) => updateWidgetProps(widget.id, { [field.key]: event.target.checked })}
                />
                {label}
              </label>
            );
          }

          if (type === 'textarea') {
            return (
              <div key={field.key}>
                <label>{label}</label>
                <textarea
                  value={String(value ?? '')}
                  rows={4}
                  onChange={(event) => updateWidgetProps(widget.id, { [field.key]: event.target.value })}
                />
              </div>
            );
          }

          if (type === 'select') {
            return (
              <div key={field.key}>
                <label>{label}</label>
                <select
                  value={String(value ?? '')}
                  onChange={(event) => updateWidgetProps(widget.id, { [field.key]: event.target.value })}
                >
                  {(field.options ?? []).map((option) => (
                    <option key={`${field.key}-${option.value}`} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            );
          }

          return (
            <div key={field.key}>
              <label>{label}</label>
              <input
                type={type}
                step={type === 'number' ? '1' : undefined}
                value={String(value ?? '')}
                onChange={(event) => updateWidgetProps(widget.id, { [field.key]: type === 'number' ? Number(event.target.value) : event.target.value })}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
