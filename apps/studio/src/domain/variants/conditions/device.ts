import type { VariantContext, VariantDevice } from '../types';

export function matchesDeviceCondition(context: VariantContext, expected: VariantDevice): boolean {
  return context.device === expected;
}
