type InspectorRangeFieldProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
  helpText?: string;
};

function formatRangeValue(value: number, unit = ''): string {
  const precision = Number.isInteger(value) ? 0 : 2;
  return `${value.toFixed(precision).replace(/\.?0+$/, '')}${unit}`;
}

export function InspectorRangeField({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  onChange,
  helpText,
}: InspectorRangeFieldProps): JSX.Element {
  const safeValue = Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : min;
  const fieldId = `inspector-range-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

  return (
    <div className="inspector-range-field">
      <div className="inspector-range-field__header">
        <label htmlFor={fieldId}>{label}</label>
        <output htmlFor={fieldId} className="inspector-range-field__value">
          {formatRangeValue(safeValue, unit)}
        </output>
      </div>
      <input
        id={fieldId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="inspector-range-field__ticks" aria-hidden="true">
        <span>{formatRangeValue(min, unit)}</span>
        <span>{formatRangeValue(max, unit)}</span>
      </div>
      {helpText ? <small className="muted">{helpText}</small> : null}
    </div>
  );
}
