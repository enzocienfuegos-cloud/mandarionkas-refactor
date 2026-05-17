import type { MotionConfig, MotionTemplate } from '../motion-template-contract';

type MotionConfigFieldsProps = {
  template: MotionTemplate;
  config: MotionConfig;
  onChange: (patch: MotionConfig) => void;
};

function getNumberValue(value: MotionConfig[string] | undefined, fallback: number): number {
  const numericValue = Number(value ?? fallback);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function formatNumberValue(value: number, unit?: string): string {
  const precision = Number.isInteger(value) ? 0 : 2;
  const formatted = value.toFixed(precision).replace(/\.?0+$/, '');
  return unit ? `${formatted}${unit}` : formatted;
}

export function MotionConfigFields({ template, config, onChange }: MotionConfigFieldsProps): JSX.Element {
  return (
    <div className="fields-grid motion-config-grid">
      {template.fields.map((field) => {
        const fieldId = `motion-field-${template.id}-${field.key}`;
        if (field.kind === 'number') {
          const value = getNumberValue(config[field.key], field.defaultValue);
          const valueLabel = formatNumberValue(value, field.unit);
          return (
            <div key={field.key} className="motion-config-field motion-config-field--slider">
              <div className="motion-config-field__header">
                <label htmlFor={fieldId}>{field.label}</label>
                <output htmlFor={fieldId} className="motion-config-field__value">{valueLabel}</output>
              </div>
              <input
                id={fieldId}
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={value}
                onChange={(event) => onChange({ [field.key]: Number(event.target.value) })}
              />
              <div className="motion-config-field__presets" aria-label={`${field.label} presets`}>
                <span>{formatNumberValue(field.min, field.unit)}</span>
                <button type="button" onClick={() => onChange({ [field.key]: field.defaultValue })}>
                  Default {formatNumberValue(field.defaultValue, field.unit)}
                </button>
                <span>{formatNumberValue(field.max, field.unit)}</span>
              </div>
            </div>
          );
        }
        return (
          <div key={field.key} className="motion-config-field">
            <label htmlFor={fieldId}>{field.label}</label>
            <select
              id={fieldId}
              value={String(config[field.key] ?? field.defaultValue)}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
        );
      })}
    </div>
  );
}
