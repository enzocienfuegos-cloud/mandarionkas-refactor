import type { StudioTemplate } from './types';
import { buildTemplateThumbnailDataUrl } from './template-thumbnails';

const templates = new Map<string, StudioTemplate>();

type TemplateModule = Record<string, unknown>;

function isStudioTemplate(value: unknown): value is StudioTemplate {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StudioTemplate>;
  return (
    !!candidate.metadata
    && typeof candidate.metadata.id === 'string'
    && typeof candidate.metadata.name === 'string'
    && typeof candidate.buildDocument === 'function'
  );
}

export function registerTemplate(template: StudioTemplate): void {
  if (!template.metadata.thumbnail) {
    template.metadata.thumbnail = buildTemplateThumbnailDataUrl(template.metadata);
  }
  const existing = templates.get(template.metadata.id);
  if (existing && existing !== template) {
    throw new Error(`Duplicate template registered: ${template.metadata.id}`);
  }
  templates.set(template.metadata.id, template);
}

const templateModules = import.meta.glob('./*/index.ts', { eager: true }) as Record<string, TemplateModule>;

Object.values(templateModules).forEach((mod) => {
  Object.values(mod).forEach((value) => {
    if (isStudioTemplate(value)) {
      registerTemplate(value);
    }
  });
});

export function listTemplates(filter?: { vertical?: string }): StudioTemplate[] {
  return [...templates.values()]
    .filter((template) => !filter?.vertical || template.metadata.vertical === filter.vertical)
    .sort((a, b) => {
      const featuredDelta = Number(Boolean(b.metadata.featured)) - Number(Boolean(a.metadata.featured));
      if (featuredDelta) return featuredDelta;
      const rankDelta = (b.metadata.curationRank ?? 0) - (a.metadata.curationRank ?? 0);
      if (rankDelta) return rankDelta;
      return a.metadata.name.localeCompare(b.metadata.name) || a.metadata.id.localeCompare(b.metadata.id);
    });
}

export function getTemplate(id: string): StudioTemplate | undefined {
  return templates.get(id);
}
