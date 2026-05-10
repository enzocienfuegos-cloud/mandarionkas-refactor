import type { VariantContext } from '../types';

export function matchesAudienceCondition(context: VariantContext, expected: string): boolean {
  return String(context.audience ?? '') === String(expected);
}
