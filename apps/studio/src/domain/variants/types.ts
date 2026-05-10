import type { StudioDocument } from '../document/types';

export type VariantWeather = 'sunny' | 'rainy' | 'cloudy' | 'snowy';
export type VariantTimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';
export type VariantDevice = 'mobile' | 'tablet' | 'desktop';

export type VariantContext = {
  audience?: string;
  locale?: string;
  weather?: VariantWeather;
  timeOfDay?: VariantTimeOfDay;
  device?: VariantDevice;
};

export type VariantCondition =
  | { type: 'audience'; equals: string }
  | { type: 'locale'; equals: string | string[] }
  | { type: 'weather'; equals: VariantWeather }
  | { type: 'timeOfDay'; equals: VariantTimeOfDay }
  | { type: 'device'; equals: VariantDevice };

export type VariantPatch = {
  path: string;
  value: unknown;
};

export type VariantRule = {
  id: string;
  name: string;
  when: VariantCondition[];
  set: VariantPatch[];
};

export type VariantRuleMatch = {
  rule: VariantRule;
  matched: boolean;
};

export type ApplyVariantRulesResult = {
  document: StudioDocument;
  matches: VariantRuleMatch[];
};
