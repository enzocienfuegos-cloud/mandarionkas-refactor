import type { VariantContext } from '../types';

export function matchesLocaleCondition(context: VariantContext, expected: string | string[]): boolean {
  const locale = String(context.locale ?? '').toLowerCase();
  const expectedValues = Array.isArray(expected) ? expected : [expected];
  return expectedValues.some((value) => locale === String(value).toLowerCase());
}
