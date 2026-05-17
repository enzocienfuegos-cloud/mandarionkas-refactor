import type { MotionConfig, MotionTemplate } from '../motion-template-contract';

type MotionConfigFieldsProps = {
  template: MotionTemplate;
  config: MotionConfig;
  onChange: (patch: MotionConfig) => void;
};

export function MotionConfigFields({ template, config, onChange }: MotionConfigFieldsProps): JSX.Element {
  return (
    <div className="fields-grid motion-config-grid">
      {template.fields.map((field) => (
        <div key={field.key} className="motion-config-field">
          <label>
            {field.label}
            {field.kind === 'number' && field.unit ? <span className="motion-config-field__unit">{field.unit}</span> : null}
          </label>
          {field.kind === 'number' ? (
            <input
              type="number"
              min={field.min}
              max={field.max}
              step={field.step}
              value={Number(config[field.key] ?? field.defaultValue)}
              onChange={(event) => onChange({ [field.key]: Number(event.target.value) })}
            />
          ) : (
            <select
              value={String(config[field.key] ?? field.defaultValue)}
              onChange={(event) => onChange({ [field.key]: event.target.value })}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}
