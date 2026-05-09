import type { ReactNode } from 'react';
import { ColorControl } from '../shared/ui/ColorControl';

type FieldBase = {
  label: ReactNode;
  labelAccessory?: ReactNode;
  helperText?: ReactNode;
  wrapperClassName?: string;
  disabled?: boolean;
};

type TextFieldSpec = FieldBase & {
  kind: 'text';
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  readOnly?: boolean;
};

type NumberFieldSpec = FieldBase & {
  kind: 'number';
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
};

type TextareaFieldSpec = FieldBase & {
  kind: 'textarea';
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  placeholder?: string;
};

type SelectFieldSpec = FieldBase & {
  kind: 'select';
  value: string;
  onChange: (value: string) => void;
  options: Array<{ label: ReactNode; value: string; disabled?: boolean }>;
};

type CheckboxFieldSpec = FieldBase & {
  kind: 'checkbox';
  checked: boolean;
  onChange: (checked: boolean) => void;
};

type ColorFieldSpec = FieldBase & {
  kind: 'color';
  value: string;
  onChange: (value: string) => void;
  fallback: string;
  noneValue?: string;
  noneLabel?: string;
};

export type StudioFieldSchema =
  | TextFieldSpec
  | NumberFieldSpec
  | TextareaFieldSpec
  | SelectFieldSpec
  | CheckboxFieldSpec
  | ColorFieldSpec;

export type FieldSpec = StudioFieldSchema;

export type SectionSpec = {
  title?: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
};

function renderLabel(label: ReactNode, accessory?: ReactNode): JSX.Element {
  if (!accessory) return <label>{label}</label>;
  return (
    <label className="inspector-field-label">
      <span>{label}</span>
      {accessory}
    </label>
  );
}

export function renderSchemaField(
  schema: StudioFieldSchema,
  value: unknown = 'checked' in schema ? schema.checked : schema.value,
  onChange: ((value: unknown) => void) | undefined = schema.onChange as (value: unknown) => void,
): JSX.Element {
  switch (schema.kind) {
    case 'checkbox':
      return (
        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={Boolean(value)}
            disabled={schema.disabled}
            onChange={(event) => onChange?.(event.target.checked)}
          />
          {schema.label}
        </label>
      );
    case 'textarea':
      return (
        <>
          {renderLabel(schema.label, schema.labelAccessory)}
          <textarea
            rows={schema.rows ?? 4}
            value={String(value ?? '')}
            placeholder={schema.placeholder}
            disabled={schema.disabled}
            onChange={(event) => onChange?.(event.target.value)}
          />
        </>
      );
    case 'select':
      return (
        <>
          {renderLabel(schema.label, schema.labelAccessory)}
          <select
            value={String(value ?? '')}
            disabled={schema.disabled}
            onChange={(event) => onChange?.(event.target.value)}
          >
            {schema.options.map((option) => (
              <option key={`${String(option.value)}-${String(option.label)}`} value={option.value} disabled={option.disabled}>
                {option.label}
              </option>
            ))}
          </select>
        </>
      );
    case 'number':
      return (
        <>
          {renderLabel(schema.label, schema.labelAccessory)}
          <input
            type="number"
            min={schema.min}
            max={schema.max}
            step={schema.step}
            value={Number(value ?? 0)}
            placeholder={schema.placeholder}
            disabled={schema.disabled}
            onChange={(event) => onChange?.(Number(event.target.value))}
          />
        </>
      );
    case 'color':
      const colorLabel = typeof schema.label === 'string' ? schema.label : 'Color';
      return (
        <ColorControl
          label={colorLabel}
          labelAccessory={schema.labelAccessory}
          value={String(value ?? '')}
          fallback={schema.fallback}
          noneValue={schema.noneValue}
          noneLabel={schema.noneLabel}
          onChange={(nextValue) => onChange?.(nextValue)}
        />
      );
    case 'text':
    default:
      return (
        <>
          {renderLabel(schema.label, schema.labelAccessory)}
          <input
            type="text"
            value={String(value ?? '')}
            placeholder={schema.placeholder}
            disabled={schema.disabled}
            readOnly={schema.readOnly}
            onChange={(event) => onChange?.(event.target.value)}
          />
        </>
      );
  }
}

export function createInspectorField(spec: FieldSpec): JSX.Element {
  if (spec.kind === 'checkbox') {
    return (
      <div className={spec.wrapperClassName}>
        {renderSchemaField(spec)}
        {spec.helperText ? <small className="muted">{spec.helperText}</small> : null}
      </div>
    );
  }

  return (
    <div className={spec.wrapperClassName}>
      {renderSchemaField(spec)}
      {spec.helperText ? <small className="muted">{spec.helperText}</small> : null}
    </div>
  );
}

export function createInspectorSection({
  title,
  description,
  meta,
  actions,
  className = '',
  bodyClassName = 'field-stack',
  children,
}: SectionSpec): JSX.Element {
  return (
    <section className={`section section-premium ${className}`.trim()}>
      {title || actions ? (
        <div className="section-heading-row">
          <div>
            {title ? <h3>{title}</h3> : null}
            {description ? <small className="muted">{description}</small> : null}
          </div>
          {actions}
        </div>
      ) : null}
      <div className={bodyClassName}>
        {meta}
        {children}
      </div>
    </section>
  );
}
