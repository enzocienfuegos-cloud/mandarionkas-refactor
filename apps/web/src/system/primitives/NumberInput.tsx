import React, { useMemo, useState } from 'react';
import { Input, type InputSize } from './Input';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export interface NumberInputProps {
  value: number | null;
  onChange: (value: number | null) => void;
  format?: 'integer' | 'decimal' | 'currency' | 'percent';
  currency?: string;
  decimals?: number;
  min?: number;
  max?: number;
  step?: number;
  locale?: string;
  nullable?: boolean;
  size?: InputSize;
  invalid?: boolean;
  placeholder?: string;
  fullWidth?: boolean;
  disabled?: boolean;
}

export function NumberInput({
  value,
  onChange,
  format = 'integer',
  currency = 'USD',
  decimals = 2,
  min,
  max,
  step = 1,
  locale = 'en-US',
  nullable = true,
  size = 'md',
  invalid = false,
  placeholder,
  fullWidth = true,
  disabled = false,
}: NumberInputProps) {
  const [focused, setFocused] = useState(false);
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const decimalSeparator = useMemo(() => {
    const part = numberFormatter.formatToParts(1.1).find((entry) => entry.type === 'decimal');
    return part?.value ?? '.';
  }, [numberFormatter]);
  const groupSeparator = useMemo(() => {
    const part = numberFormatter.formatToParts(10000).find((entry) => entry.type === 'group');
    return part?.value ?? '';
  }, [numberFormatter]);
  const formatter = useMemo(() => new Intl.NumberFormat(locale, {
    style: format === 'currency' ? 'currency' : format === 'percent' ? 'percent' : 'decimal',
    currency,
    minimumFractionDigits: format === 'integer' ? 0 : decimals,
    maximumFractionDigits: format === 'integer' ? 0 : decimals,
  }), [currency, decimals, format, locale]);

  const displayValue = focused
    ? value?.toString() ?? ''
    : value == null
      ? ''
      : formatter.format(value);

  const clamp = (next: number) => {
    let current = next;
    if (typeof min === 'number') current = Math.max(min, current);
    if (typeof max === 'number') current = Math.min(max, current);
    return current;
  };

  const parseInputValue = (rawValue: string) => {
    const trimmed = rawValue.trim();
    if (!trimmed) return null;
    const decimalPattern = escapeRegex(decimalSeparator);
    const groupingPattern = groupSeparator ? escapeRegex(groupSeparator) : '';
    const withoutGrouping = groupingPattern
      ? trimmed.replace(new RegExp(groupingPattern, 'g'), '')
      : trimmed;
    const cleaned = withoutGrouping.replace(new RegExp(`[^\\d${decimalPattern}\\-]`, 'g'), '');
    const normalized = trimmed
      ? cleaned.replace(new RegExp(decimalPattern, 'g'), '.')
      : '';
    if (!normalized || normalized === '.' || normalized === '-' || normalized === '+') return null;
    const next = Number(normalized);
    return Number.isFinite(next) ? next : null;
  };

  return (
    <Input
      inputSize={size}
      value={displayValue}
      invalid={invalid}
      placeholder={placeholder}
      fullWidth={fullWidth}
      disabled={disabled}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        setFocused(false);
        const next = parseInputValue(event.target.value);
        if (next == null) {
          onChange(nullable ? null : 0);
          return;
        }
        onChange(clamp(next));
      }}
      onChange={(event) => {
        const next = parseInputValue(event.target.value);
        if (next == null) {
          onChange(nullable ? null : 0);
          return;
        }
        onChange(clamp(next));
      }}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') {
          event.preventDefault();
          onChange(clamp((value ?? 0) + step));
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          onChange(clamp((value ?? 0) - step));
        }
      }}
    />
  );
}
