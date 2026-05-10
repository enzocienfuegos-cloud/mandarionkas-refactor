import { useWidgetActions } from '../../hooks/use-studio-actions';
import type { WidgetNode } from '../../domain/document/types';
import { createInspectorField, createInspectorSection } from '../../inspector/contract-driven';
import { toLabel } from '../../inspector/sections/widget-inspector-shared';
import type { WidgetFieldSpec } from './widget-definition';

export function WidgetFieldInspectorSection({ widget, title = 'Widget settings', fields }: { widget: WidgetNode; title?: string; fields: WidgetFieldSpec[] }): JSX.Element {
  const { updateWidgetProps } = useWidgetActions();

  return createInspectorSection({
    title,
    children: (
      <>
        {fields.map((field) => {
          const value = widget.props[field.key];
          const label = field.label ?? toLabel(field.key);
          const type = field.type ?? (typeof value === 'number' ? 'number' : typeof value === 'boolean' ? 'checkbox' : 'text');

          if (type === 'checkbox') {
            return <div key={field.key}>{createInspectorField({ kind: 'checkbox', label, checked: Boolean(value), onChange: (checked) => updateWidgetProps(widget.id, { [field.key]: checked }) })}</div>;
          }

          if (type === 'textarea') {
            return <div key={field.key}>{createInspectorField({ kind: 'textarea', label, value: String(value ?? ''), rows: 4, onChange: (nextValue) => updateWidgetProps(widget.id, { [field.key]: nextValue }) })}</div>;
          }

          if (type === 'select') {
            return <div key={field.key}>{createInspectorField({ kind: 'select', label, value: String(value ?? ''), onChange: (nextValue) => updateWidgetProps(widget.id, { [field.key]: nextValue }), options: (field.options ?? []).map((option) => ({ label: option.label, value: option.value })) })}</div>;
          }

          if (type === 'number') {
            return <div key={field.key}>{createInspectorField({ kind: 'number', label, value: Number(value ?? 0), step: 1, onChange: (nextValue: number) => updateWidgetProps(widget.id, { [field.key]: nextValue }) })}</div>;
          }

          return <div key={field.key}>{createInspectorField({ kind: 'text', label, value: String(value ?? ''), onChange: (nextValue: string) => updateWidgetProps(widget.id, { [field.key]: nextValue }) })}</div>;
        })}
      </>
    ),
  });
}
