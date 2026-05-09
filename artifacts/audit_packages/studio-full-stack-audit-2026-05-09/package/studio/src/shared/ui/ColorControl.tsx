import type { CSSProperties, ReactNode } from 'react';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

const colorControlStackStyle: CSSProperties = {
  display: 'grid',
  gap: 8,
};

const colorControlCompactStackStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '44px minmax(0, 1fr)',
  gap: 8,
  alignItems: 'center',
};

const colorControlSwatchStyle: CSSProperties = {
  width: 44,
  minWidth: 44,
};

const colorControlClearButtonStyle: CSSProperties = {
  minWidth: 44,
  padding: '0 8px',
};

function normalizeHex(value: string): string | null {
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-f]{6})$/i.exec(trimmed);
  return full ? `#${full[1].toLowerCase()}` : null;
}

function parseRgbTriplet(value: string): [number, number, number] | null {
  const hex = normalizeHex(value);
  if (hex) {
    const normalized = hex.slice(1);
    return [
      Number.parseInt(normalized.slice(0, 2), 16),
      Number.parseInt(normalized.slice(2, 4), 16),
      Number.parseInt(normalized.slice(4, 6), 16),
    ];
  }
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i.exec(value.trim());
  if (!rgb) return null;
  const triplet = rgb.slice(1).map((part) => Math.max(0, Math.min(255, Number.parseInt(part, 10)))) as [number, number, number];
  return triplet;
}

function toHex(value: string, fallback: string): string {
  const triplet = parseRgbTriplet(value) ?? parseRgbTriplet(fallback) ?? [255, 255, 255];
  return `#${triplet.map((part) => part.toString(16).padStart(2, '0')).join('')}`;
}

function toRgbLabel(value: string, fallback: string): string {
  const triplet = parseRgbTriplet(value) ?? parseRgbTriplet(fallback);
  return triplet ? `rgb(${triplet[0]}, ${triplet[1]}, ${triplet[2]})` : 'rgb(255, 255, 255)';
}

export function ColorControl({
  label,
  value,
  fallback = '#ffffff',
  onChange,
  placeholder,
  compact = false,
  allowNone = true,
  noneValue = '',
  noneLabel = 'None',
  labelAccessory,
}: {
  label: string;
  value: string;
  fallback?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  compact?: boolean;
  allowNone?: boolean;
  noneValue?: string;
  noneLabel?: string;
  labelAccessory?: ReactNode;
}): JSX.Element {
  const swatchValue = toHex(value, fallback);
  const rgbValue = toRgbLabel(value, fallback);
  const stackStyle = compact ? colorControlCompactStackStyle : colorControlStackStyle;

  return (
    <div>
      <label className={labelAccessory ? 'inspector-field-label' : undefined}>
        <span>{label}</span>
        {labelAccessory}
      </label>
      <div style={stackStyle}>
        <div style={colorControlStackStyle}>
          <input
            type="color"
            aria-label={`${label} picker`}
            value={swatchValue}
            onChange={(event) => onChange(event.target.value)}
            className="color-swatch-input"
            style={colorControlSwatchStyle}
          />
          {allowNone ? (
            <Tooltip content={`Clear ${label.toLowerCase()}`}>
              <Button
                variant="ghost"
                size="sm"
                className="compact-action"
                style={colorControlClearButtonStyle}
                onClick={() => onChange(noneValue)}
                aria-label={`Clear ${label.toLowerCase()}`}
              >
                {noneLabel}
              </Button>
            </Tooltip>
          ) : null}
        </div>
        <div style={colorControlStackStyle}>
          <input
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder ?? '#ffffff, rgb(255, 255, 255), transparent, or empty'}
          />
          <input
            className="color-rgb-readout"
            value={rgbValue}
            readOnly
            aria-label="Selectable RGB value"
            onFocus={(event) => event.currentTarget.select()}
          />
        </div>
      </div>
    </div>
  );
}
