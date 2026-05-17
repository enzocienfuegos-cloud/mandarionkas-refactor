export function parseJsonAttribute<T>(node: Element | null, attribute: string, fallback: T): T {
  if (!node) return fallback;
  const value = node.getAttribute(attribute);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function wrapIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

export function shouldShowMediaCaption(value: unknown): boolean {
  const caption = String(value || '').trim();
  if (!caption) return false;
  return !(/\.[a-z0-9]{2,5}$/i.test(caption) || /[_-]/.test(caption));
}

export function isHTMLElement(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLElement;
}
