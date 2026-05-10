export type WidgetSchemaField =
  | {
      type: 'string';
      default?: string;
      enum?: readonly string[];
      minLength?: number;
      maxLength?: number;
    }
  | {
      type: 'number';
      default?: number;
      min?: number;
      max?: number;
      step?: number;
      integer?: boolean;
    }
  | {
      type: 'boolean';
      default?: boolean;
    }
  | {
      type: 'color';
      default?: string;
    }
  | {
      type: 'asset-ref';
      default?: string;
      kind?: 'image' | 'video' | 'font';
    }
  | {
      type: 'array';
      items: WidgetSchemaField;
      default?: unknown[];
    }
  | {
      type: 'object';
      shape: Record<string, WidgetSchemaField>;
      default?: Record<string, unknown>;
    };

export type WidgetSchemaMigration = {
  fromVersion: number;
  toVersion: number;
  migrate(value: Record<string, unknown>): Record<string, unknown>;
};

export type WidgetSchemaDefinition = {
  version: number;
  fields: Record<string, WidgetSchemaField>;
  migrations?: WidgetSchemaMigration[];
};

export type WidgetSchemaIssue = {
  path: string;
  message: string;
};

export type WidgetSchemaValidationResult = {
  valid: boolean;
  value: Record<string, unknown>;
  issues: WidgetSchemaIssue[];
};

export function defineWidgetSchema(schema: WidgetSchemaDefinition): WidgetSchemaDefinition {
  return schema;
}
