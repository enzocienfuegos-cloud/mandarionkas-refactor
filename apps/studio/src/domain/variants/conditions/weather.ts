import type { VariantContext, VariantWeather } from '../types';

export function matchesWeatherCondition(context: VariantContext, expected: VariantWeather): boolean {
  return context.weather === expected;
}
