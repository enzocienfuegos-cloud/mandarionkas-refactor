const DATA_WIDGET_ID_PATTERN = /\sdata-widget-id="[^"]*"/g;
const WHITESPACE_PATTERN = /\s+/g;
const STYLE_ATTR_PATTERN = /style="([^"]*)"/g;

function normalizeStyle(style: string): string {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
    .join(';');
}

export function normalizeHtml(html: string): string {
  return html
    .replace(DATA_WIDGET_ID_PATTERN, '')
    .replace(STYLE_ATTR_PATTERN, (_match, style) => `style="${normalizeStyle(style)}"`)
    .replace(/>\s+</g, '><')
    .replace(WHITESPACE_PATTERN, ' ')
    .trim();
}
