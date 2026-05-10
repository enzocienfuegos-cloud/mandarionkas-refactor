import { describe, expect, it } from 'vitest';
import {
  createVariantRule,
  formatVariantConditionEquals,
  formatVariantPatchValue,
  parseVariantConditionEquals,
  parseVariantPatchValue,
} from '../../../inspector/sections/document/variant-rules-helpers';

describe('variant rules helpers', () => {
  it('creates a starter rule with one condition and one patch', () => {
    const rule = createVariantRule(2);

    expect(rule.name).toBe('Rule 3');
    expect(rule.when).toHaveLength(1);
    expect(rule.set).toHaveLength(1);
  });

  it('parses locale conditions as a list when multiple locales are provided', () => {
    const equals = parseVariantConditionEquals('locale', 'es-SV, es-ES');

    expect(equals).toEqual(['es-SV', 'es-ES']);
    expect(formatVariantConditionEquals({ type: 'locale', equals })).toBe('es-SV, es-ES');
  });

  it('parses patch values into booleans, numbers and json when possible', () => {
    expect(parseVariantPatchValue('true')).toBe(true);
    expect(parseVariantPatchValue('14')).toBe(14);
    expect(parseVariantPatchValue('{"label":"ok"}')).toEqual({ label: 'ok' });
    expect(formatVariantPatchValue({ label: 'ok' })).toBe('{"label":"ok"}');
  });
});
