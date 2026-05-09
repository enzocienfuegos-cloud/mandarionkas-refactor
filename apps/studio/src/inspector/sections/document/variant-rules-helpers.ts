import type {
  VariantCondition,
  VariantContext,
  VariantDevice,
  VariantPatch,
  VariantRule,
  VariantTimeOfDay,
  VariantWeather,
} from '../../../domain/variants/types';

export const VARIANT_WEATHER_OPTIONS: VariantWeather[] = ['sunny', 'rainy', 'cloudy', 'snowy'];
export const VARIANT_TIME_OPTIONS: VariantTimeOfDay[] = ['morning', 'afternoon', 'evening', 'night'];
export const VARIANT_DEVICE_OPTIONS: VariantDevice[] = ['mobile', 'tablet', 'desktop'];

export const DEFAULT_VARIANT_PREVIEW_CONTEXT: VariantContext = {
  audience: '',
  locale: '',
  weather: 'sunny',
  timeOfDay: 'morning',
  device: 'mobile',
};

export function createVariantCondition(type: VariantCondition['type'] = 'audience'): VariantCondition {
  switch (type) {
    case 'locale':
      return { type, equals: '' };
    case 'weather':
      return { type, equals: 'sunny' };
    case 'timeOfDay':
      return { type, equals: 'morning' };
    case 'device':
      return { type, equals: 'mobile' };
    case 'audience':
    default:
      return { type: 'audience', equals: '' };
  }
}

export function createVariantPatch(): VariantPatch {
  return {
    path: '',
    value: '',
  };
}

export function createVariantRule(index: number): VariantRule {
  return {
    id: `variant_rule_${index + 1}`,
    name: `Rule ${index + 1}`,
    when: [createVariantCondition()],
    set: [createVariantPatch()],
  };
}

export function parseVariantConditionEquals(type: VariantCondition['type'], raw: string): VariantCondition['equals'] {
  if (type === 'locale') {
    const values = raw.split(',').map((value) => value.trim()).filter(Boolean);
    return values.length > 1 ? values : values[0] ?? '';
  }
  if (type === 'weather') return (raw || 'sunny') as VariantWeather;
  if (type === 'timeOfDay') return (raw || 'morning') as VariantTimeOfDay;
  if (type === 'device') return (raw || 'mobile') as VariantDevice;
  return raw.trim();
}

export function formatVariantConditionEquals(condition: VariantCondition): string {
  if (Array.isArray(condition.equals)) return condition.equals.join(', ');
  return String(condition.equals ?? '');
}

export function parseVariantPatchValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return raw;
    }
  }
  return raw;
}

export function formatVariantPatchValue(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value === null) return 'null';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch {
    return String(value ?? '');
  }
}
