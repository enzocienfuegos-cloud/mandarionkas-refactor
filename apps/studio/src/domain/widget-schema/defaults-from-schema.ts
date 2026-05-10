import type { WidgetSchemaDefinition, WidgetSchemaField } from './types';

function getFieldDefault(field: WidgetSchemaField): unknown {
  switch (field.type) {
    case 'string':
    case 'color':
    case 'asset-ref':
      return field.default ?? '';
    case 'number':
      return field.default ?? 0;
    case 'boolean':
      return field.default ?? false;
    case 'array':
      return field.default ? [...field.default] : [];
    case 'object': {
      const nestedDefaults = Object.fromEntries(
        Object.entries(field.shape).map(([key, nestedField]) => [key, getFieldDefault(nestedField)]),
      );
      return field.default ? { ...nestedDefaults, ...field.default } : nestedDefaults;
    }
    default:
      return undefined;
  }
}

export function defaultsFromWidgetSchema(schema: WidgetSchemaDefinition): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(schema.fields).map(([key, field]) => [key, getFieldDefault(field)]),
  );
}
