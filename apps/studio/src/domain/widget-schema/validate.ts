import { defaultsFromWidgetSchema } from './defaults-from-schema';
import type { WidgetSchemaDefinition, WidgetSchemaField, WidgetSchemaIssue, WidgetSchemaValidationResult } from './types';

function clampNumber(value: number, field: Extract<WidgetSchemaField, { type: 'number' }>): number {
  let nextValue = value;
  if (field.integer) nextValue = Math.round(nextValue);
  if (typeof field.min === 'number') nextValue = Math.max(field.min, nextValue);
  if (typeof field.max === 'number') nextValue = Math.min(field.max, nextValue);
  return nextValue;
}

function validateField(field: WidgetSchemaField, value: unknown, path: string): { value: unknown; issues: WidgetSchemaIssue[] } {
  switch (field.type) {
    case 'string': {
      const issues: WidgetSchemaIssue[] = [];
      const fallback = field.default ?? '';
      const nextValue = typeof value === 'string' ? value : fallback;
      if (typeof value !== 'string') {
        issues.push({ path, message: 'Expected string.' });
      }
      if (field.enum && !field.enum.includes(nextValue)) {
        issues.push({ path, message: `Expected one of: ${field.enum.join(', ')}.` });
        return { value: fallback, issues };
      }
      if (typeof field.minLength === 'number' && nextValue.length < field.minLength) {
        issues.push({ path, message: `Expected at least ${field.minLength} characters.` });
      }
      if (typeof field.maxLength === 'number' && nextValue.length > field.maxLength) {
        issues.push({ path, message: `Expected at most ${field.maxLength} characters.` });
      }
      return { value: nextValue, issues };
    }
    case 'color':
    case 'asset-ref':
      if (typeof value !== 'string') {
        return { value: field.default ?? '', issues: [{ path, message: `Expected ${field.type}.` }] };
      }
      return { value, issues: [] };
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        return { value: clampNumber(field.default ?? 0, field), issues: [{ path, message: 'Expected number.' }] };
      }
      const normalized = clampNumber(value, field);
      const issues = normalized === value ? [] : [{ path, message: 'Number was normalized to fit schema bounds.' }];
      return { value: normalized, issues };
    }
    case 'boolean':
      if (typeof value !== 'boolean') {
        return { value: field.default ?? false, issues: [{ path, message: 'Expected boolean.' }] };
      }
      return { value, issues: [] };
    case 'array': {
      if (!Array.isArray(value)) {
        return { value: field.default ? [...field.default] : [], issues: [{ path, message: 'Expected array.' }] };
      }
      const issues: WidgetSchemaIssue[] = [];
      const nextValue = value.map((item, index) => {
        const validated = validateField(field.items, item, `${path}[${index}]`);
        issues.push(...validated.issues);
        return validated.value;
      });
      return { value: nextValue, issues };
    }
    case 'object': {
      const baseDefaults = (field.default ? { ...defaultsFromWidgetSchema({ version: 1, fields: field.shape }), ...field.default } : defaultsFromWidgetSchema({ version: 1, fields: field.shape })) as Record<string, unknown>;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { value: baseDefaults, issues: [{ path, message: 'Expected object.' }] };
      }
      const rawValue = value as Record<string, unknown>;
      const nextValue: Record<string, unknown> = { ...rawValue };
      const issues: WidgetSchemaIssue[] = [];
      Object.entries(field.shape).forEach(([key, nestedField]) => {
        const validated = validateField(nestedField, rawValue[key], `${path}.${key}`);
        nextValue[key] = validated.value;
        issues.push(...validated.issues);
      });
      return { value: { ...baseDefaults, ...nextValue }, issues };
    }
    default:
      return { value, issues: [] };
  }
}

export function validateWidgetSchemaValue(
  schema: WidgetSchemaDefinition,
  value: Record<string, unknown>,
): WidgetSchemaValidationResult {
  const defaults = defaultsFromWidgetSchema(schema);
  const nextValue: Record<string, unknown> = { ...defaults, ...value };
  const issues: WidgetSchemaIssue[] = [];

  Object.entries(schema.fields).forEach(([key, field]) => {
    const validated = validateField(field, nextValue[key], key);
    nextValue[key] = validated.value;
    issues.push(...validated.issues);
  });

  return {
    valid: issues.length === 0,
    value: nextValue,
    issues,
  };
}
