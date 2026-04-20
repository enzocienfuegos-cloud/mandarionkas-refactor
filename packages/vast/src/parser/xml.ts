import { VASTErrors } from '../errors.js';

type XmlParser = { parseFromString(xml: string, mimeType: string): unknown };

function getParser(): XmlParser {
  if (typeof DOMParser !== 'undefined') {
    return new DOMParser();
  }
  throw VASTErrors.parseError('No XML parser available. Provide a DOMParser polyfill in non-browser environments.');
}

export function parseXml(rawXml: string): Document {
  const parser = getParser();
  let doc: Document;

  try {
    doc = parser.parseFromString(rawXml, 'text/xml') as Document;
  } catch (error) {
    throw VASTErrors.parseError(String(error));
  }

  const parseError = queryFirst(doc, ['parsererror']);
  if (parseError) {
    throw VASTErrors.parseError(parseError.textContent ?? 'Unknown XML error');
  }

  return doc;
}

function normalizeSegment(segment: string): { tag: string; direct: boolean } {
  const trimmed = segment.trim();
  if (!trimmed) return { tag: '', direct: false };
  if (trimmed === ':scope') {
    return { tag: '', direct: true };
  }
  return { tag: trimmed, direct: false };
}

function getElementChildren(parent: Element | Document): Element[] {
  if ('documentElement' in parent && parent.documentElement) {
    return getElementChildren(parent.documentElement);
  }
  const nodes = (parent as Element).childNodes ?? [];
  return Array.from(nodes).filter((node) => node.nodeType === 1) as Element[];
}

function findChildrenByTag(parent: Element | Document, tag: string, direct: boolean): Element[] {
  if (!tag) return [];
  if (direct) {
    const children = getElementChildren(parent);
    return children.filter((child) => child.tagName === tag);
  }
  if ('getElementsByTagName' in parent) {
    return Array.from(parent.getElementsByTagName(tag));
  }
  return [];
}

function queryAllInternal(parent: Element | Document, selector: string): Element[] {
  const rawSegments = selector.split(/\s*>\s*/).map((segment) => normalizeSegment(segment)).filter((segment) => segment.tag);
  const segments = rawSegments.map((segment, index) => ({
    ...segment,
    direct: rawSegments.length > 1 ? index > 0 : segment.direct,
  }));
  if (!segments.length) return [];

  let current: Array<Element | Document> = [parent];
  for (const segment of segments) {
    current = current.flatMap((item) => findChildrenByTag(item, segment.tag, segment.direct));
  }
  return current as Element[];
}

function queryFirst(parent: Element | Document, selectors: string[]): Element | undefined {
  for (const selector of selectors) {
    const match = queryAllInternal(parent, selector)[0];
    if (match) return match;
  }
  return undefined;
}

export function getText(parent: Element | Document, selector: string): string | undefined {
  const element = queryFirst(parent, [selector]);
  const text = element?.textContent?.trim();
  return text || undefined;
}

export function getAll(parent: Element | Document, selector: string): Element[] {
  return queryAllInternal(parent, selector);
}

export function attr(el: Element, name: string): string | undefined {
  const value = el.getAttribute(name);
  return value !== null && value !== '' ? value : undefined;
}

export function parseDuration(raw: string | undefined): number {
  if (!raw) return NaN;
  const trimmed = raw.trim();
  const parts = trimmed.split(':');
  if (parts.length === 3) {
    const hours = Number(parts[0]);
    const minutes = Number(parts[1]);
    const seconds = parseFloat(parts[2]);
    if (!Number.isNaN(hours) && !Number.isNaN(minutes) && !Number.isNaN(seconds)) {
      return hours * 3600 + minutes * 60 + seconds;
    }
  }
  return NaN;
}

export function parseSkipOffset(raw: string | undefined): number | string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.endsWith('%')) return trimmed;
  const seconds = parseDuration(trimmed);
  return Number.isNaN(seconds) ? undefined : seconds;
}
