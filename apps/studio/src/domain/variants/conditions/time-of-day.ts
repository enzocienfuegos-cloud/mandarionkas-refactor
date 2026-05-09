import type { VariantContext, VariantTimeOfDay } from '../types';

export function matchesTimeOfDayCondition(context: VariantContext, expected: VariantTimeOfDay): boolean {
  return context.timeOfDay === expected;
}
