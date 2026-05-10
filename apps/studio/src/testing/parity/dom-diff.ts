const TAG_PATTERN = /<([a-z0-9-]+)\b/gi;
const ATTR_PATTERN = /([a-z0-9:-]+)="([^"]*)"/gi;
const STYLE_KEYS = ['background', 'color', 'font-size', 'font-weight', 'text-align', 'object-fit'] as const;
const SEMANTIC_TAGS = new Set(['img', 'video', 'canvas', 'svg', 'form', 'input', 'textarea', 'select']);
const CSS_VALUE_ALIASES: Record<string, string> = {
  'var(--surface-card-light)': '#ffffff',
};

export type DomDiffResult = {
  criticalDiffs: string[];
};

function extractText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTags(html: string): string[] {
  return [...html.matchAll(TAG_PATTERN)]
    .map((match) => match[1]?.toLowerCase() ?? '')
    .filter((tag) => tag !== '' && SEMANTIC_TAGS.has(tag));
}

function extractAttributeValues(html: string, attribute: string): string[] {
  const values: string[] = [];
  const pattern = new RegExp(`${attribute}="([^"]*)"`, 'gi');
  for (const match of html.matchAll(pattern)) {
    const value = match[1]?.trim();
    if (value) values.push(value);
  }
  return values.sort();
}

function parseStyle(style: string): Record<string, string> {
  return style
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const [rawKey, ...rawValue] = part.split(':');
      const key = rawKey?.trim().toLowerCase();
      const rawNormalizedValue = rawValue.join(':').trim();
      const value = CSS_VALUE_ALIASES[rawNormalizedValue] ?? rawNormalizedValue;
      if (!key || !value) return acc;
      acc[key] = value;
      return acc;
    }, {});
}

function extractStyleMaps(html: string): Array<Record<string, string>> {
  const styles: Array<Record<string, string>> = [];
  for (const match of html.matchAll(ATTR_PATTERN)) {
    if (match[1]?.toLowerCase() !== 'style') continue;
    styles.push(parseStyle(match[2] ?? ''));
  }
  return styles;
}

function extractComparableStyles(html: string): Record<string, string[]> {
  const valuesByKey = new Map<string, Set<string>>();
  extractStyleMaps(html).forEach((styleMap) => {
    STYLE_KEYS.forEach((key) => {
      const value = styleMap[key];
      if (!value) return;
      if (!valuesByKey.has(key)) valuesByKey.set(key, new Set());
      valuesByKey.get(key)?.add(value);
    });
  });

  return Object.fromEntries(
    [...valuesByKey.entries()]
      .map(([key, values]) => [key, [...values].sort()] as const),
  );
}

export function domDiff(stageHtml: string, exportHtml: string): DomDiffResult {
  const criticalDiffs: string[] = [];

  const stageText = extractText(stageHtml);
  const exportText = extractText(exportHtml);
  if (stageText !== exportText) {
    criticalDiffs.push(`text content mismatch: "${stageText}" !== "${exportText}"`);
  }

  const stageTags = extractTags(stageHtml);
  const exportTags = extractTags(exportHtml);
  if (stageTags.join('|') !== exportTags.join('|')) {
    criticalDiffs.push(`semantic tag mismatch: ${stageTags.join(', ')} !== ${exportTags.join(', ')}`);
  }

  const stageSrcs = extractAttributeValues(stageHtml, 'src');
  const exportSrcs = extractAttributeValues(exportHtml, 'src');
  if (stageSrcs.join('|') !== exportSrcs.join('|')) {
    criticalDiffs.push(`asset src mismatch: ${stageSrcs.join(', ')} !== ${exportSrcs.join(', ')}`);
  }

  const stageAlts = extractAttributeValues(stageHtml, 'alt');
  const exportAlts = extractAttributeValues(exportHtml, 'alt');
  if (stageAlts.join('|') !== exportAlts.join('|')) {
    criticalDiffs.push(`alt text mismatch: ${stageAlts.join(', ')} !== ${exportAlts.join(', ')}`);
  }

  const stageStyles = extractComparableStyles(stageHtml);
  const exportStyles = extractComparableStyles(exportHtml);
  STYLE_KEYS.forEach((key) => {
    const stageValues = stageStyles[key];
    const exportValues = exportStyles[key];
    if (!stageValues?.length || !exportValues?.length) return;
    const sharedValues = stageValues.filter((value) => exportValues.includes(value));
    if (sharedValues.length === 0) {
      criticalDiffs.push(`style mismatch for ${key}: ${stageValues.join(', ')} !== ${exportValues.join(', ')}`);
    }
  });

  return { criticalDiffs };
}
