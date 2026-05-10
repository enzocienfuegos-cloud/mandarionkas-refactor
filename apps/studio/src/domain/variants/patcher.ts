import type { StudioDocument } from '../document/types';
import type { VariantPatch } from './types';

function asIndex(segment: string): number | null {
  return /^\d+$/.test(segment) ? Number(segment) : null;
}

export function applyVariantPatch(document: StudioDocument, patch: VariantPatch): StudioDocument {
  const segments = patch.path.split('.').filter(Boolean);
  if (segments.length === 0) return document;

  const draft = JSON.parse(JSON.stringify(document)) as Record<string, unknown>;
  let cursor: Record<string, unknown> | unknown[] = draft;

  for (let index = 0; index < segments.length - 1; index += 1) {
    const segment = segments[index];
    const nextSegment = segments[index + 1];
    const arrayIndex = Array.isArray(cursor) ? asIndex(segment) : null;

    if (Array.isArray(cursor)) {
      if (arrayIndex == null) return document;
      const nextValue = cursor[arrayIndex];
      if (nextValue == null || typeof nextValue !== 'object') {
        cursor[arrayIndex] = asIndex(nextSegment) == null ? {} : [];
      }
      cursor = cursor[arrayIndex] as Record<string, unknown> | unknown[];
      continue;
    }

    const currentValue = cursor[segment];
    if (currentValue == null || typeof currentValue !== 'object') {
      cursor[segment] = asIndex(nextSegment) == null ? {} : [];
    }
    cursor = cursor[segment] as Record<string, unknown> | unknown[];
  }

  const lastSegment = segments[segments.length - 1];
  if (Array.isArray(cursor)) {
    const arrayIndex = asIndex(lastSegment);
    if (arrayIndex == null) return document;
    cursor[arrayIndex] = patch.value;
  } else {
    cursor[lastSegment] = patch.value;
  }

  return draft as StudioDocument;
}

export function applyVariantPatches(document: StudioDocument, patches: VariantPatch[]): StudioDocument {
  return patches.reduce((currentDocument, patch) => applyVariantPatch(currentDocument, patch), document);
}
