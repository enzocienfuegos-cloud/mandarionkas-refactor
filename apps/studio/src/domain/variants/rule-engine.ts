import { matchesAudienceCondition } from './conditions/audience';
import { matchesDeviceCondition } from './conditions/device';
import { matchesLocaleCondition } from './conditions/locale';
import { matchesTimeOfDayCondition } from './conditions/time-of-day';
import { matchesWeatherCondition } from './conditions/weather';
import { applyVariantPatches } from './patcher';
import type {
  ApplyVariantRulesResult,
  VariantCondition,
  VariantContext,
  VariantRule,
} from './types';
import type { StudioDocument } from '../document/types';

export function matchesVariantCondition(context: VariantContext, condition: VariantCondition): boolean {
  switch (condition.type) {
    case 'audience':
      return matchesAudienceCondition(context, condition.equals);
    case 'locale':
      return matchesLocaleCondition(context, condition.equals);
    case 'weather':
      return matchesWeatherCondition(context, condition.equals);
    case 'timeOfDay':
      return matchesTimeOfDayCondition(context, condition.equals);
    case 'device':
      return matchesDeviceCondition(context, condition.equals);
    default:
      return false;
  }
}

export function matchesVariantRule(context: VariantContext, rule: VariantRule): boolean {
  return rule.when.every((condition) => matchesVariantCondition(context, condition));
}

export function applyVariantRules(
  document: StudioDocument,
  context: VariantContext,
  rules: VariantRule[],
): StudioDocument {
  return evaluateVariantRules(document, context, rules).document;
}

export function evaluateVariantRules(
  document: StudioDocument,
  context: VariantContext,
  rules: VariantRule[],
): ApplyVariantRulesResult {
  let nextDocument: StudioDocument = document;
  const matches = rules.map((rule) => {
    const matched = matchesVariantRule(context, rule);
    if (matched) {
      nextDocument = applyVariantPatches(nextDocument, rule.set);
    }
    return { rule, matched };
  });

  return {
    document: nextDocument,
    matches,
  };
}
