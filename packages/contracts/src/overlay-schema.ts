export type SchemaFieldType =
  | 'text'
  | 'url'
  | 'number'
  | 'color'
  | 'select'
  | 'toggle'
  | 'css-size'
  | 'asset-picker'
  | 'html-editor';

export interface SchemaField {
  key: string;
  label: string;
  inputType: SchemaFieldType;
  required?: boolean;
  defaultValue?: unknown;
  options?: Array<{ value: string; label: string }>;
  hint?: string;
  min?: number;
  max?: number;
}

export interface OverlayConfigSchema {
  kind: string;
  label: string;
  description: string;
  fields: SchemaField[];
}

export const COUNTDOWN_SCHEMA: OverlayConfigSchema = {
  kind: 'countdown',
  label: 'Countdown Timer',
  description: 'Displays a countdown that ticks down from a configured duration.',
  fields: [
    { key: 'fromSeconds', label: 'Count from (seconds)', inputType: 'number', required: true, defaultValue: 10, min: 1, max: 3600 },
    { key: 'completedLabel', label: 'Completed label', inputType: 'text', defaultValue: '' },
    { key: 'style.color', label: 'Text color', inputType: 'color', defaultValue: '#ffffff' },
    { key: 'style.fontSize', label: 'Font size', inputType: 'css-size', defaultValue: '2rem' },
  ],
};

export const CTA_SCHEMA: OverlayConfigSchema = {
  kind: 'cta',
  label: 'Call to Action',
  description: 'A clickable button that opens a URL.',
  fields: [
    { key: 'label', label: 'Button label', inputType: 'text', required: true, defaultValue: 'Learn More' },
    { key: 'url', label: 'Destination URL', inputType: 'url', required: true, defaultValue: '' },
    { key: 'openInNewTab', label: 'Open in new tab', inputType: 'toggle', defaultValue: true },
    { key: 'style.backgroundColor', label: 'Button color', inputType: 'color', defaultValue: '#ffffff' },
    { key: 'style.color', label: 'Text color', inputType: 'color', defaultValue: '#111111' },
    { key: 'style.borderRadius', label: 'Border radius', inputType: 'css-size', defaultValue: '4px' },
  ],
};

export const LOGO_SCHEMA: OverlayConfigSchema = {
  kind: 'logo',
  label: 'Logo / Image',
  description: 'Displays a static image or logo from your asset library.',
  fields: [
    { key: 'assetId', label: 'Image asset', inputType: 'asset-picker', required: true },
    { key: 'altText', label: 'Alt text', inputType: 'text', defaultValue: '' },
    { key: 'style.width', label: 'Width', inputType: 'css-size', defaultValue: '120px' },
    { key: 'style.opacity', label: 'Opacity', inputType: 'number', defaultValue: 1, min: 0, max: 1 },
  ],
};

export const CUSTOM_HTML_SCHEMA: OverlayConfigSchema = {
  kind: 'custom-html',
  label: 'Custom HTML',
  description: 'Embed a custom HTML snippet. Rendered in a sandboxed iframe.',
  fields: [
    { key: 'html', label: 'HTML content', inputType: 'html-editor', required: true, defaultValue: '<p>Custom content</p>' },
  ],
};

export const OVERLAY_SCHEMA_REGISTRY: Record<string, OverlayConfigSchema> = {
  countdown: COUNTDOWN_SCHEMA,
  cta: CTA_SCHEMA,
  logo: LOGO_SCHEMA,
  'custom-html': CUSTOM_HTML_SCHEMA,
};
