export type BrandKitColorTokens = {
  background?: string;
  surface?: string;
  text?: string;
  accent?: string;
  border?: string;
  muted?: string;
};

export type BrandKitTypography = {
  fontFamily?: string;
  headingFamily?: string;
  bodyFamily?: string;
  baseSizePx?: number;
  weightRegular?: number;
  weightStrong?: number;
};

export type BrandKitRadii = {
  sm?: number;
  md?: number;
  lg?: number;
  pill?: number;
};

export type BrandKitMotion = {
  durationMs?: number;
  easing?: string;
};

export type BrandKitLogos = {
  primaryUrl?: string;
  secondaryUrl?: string;
  iconUrl?: string;
};

export type BrandKit = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  brandId?: string;
  brandName?: string;
  colors?: BrandKitColorTokens;
  typography?: BrandKitTypography;
  radii?: BrandKitRadii;
  motion?: BrandKitMotion;
  logos?: BrandKitLogos;
  createdAt: string;
  updatedAt: string;
};

export type BrandKitDraft = {
  name: string;
  description?: string;
  brandId?: string;
  brandName?: string;
  colors?: BrandKitColorTokens;
  typography?: BrandKitTypography;
  radii?: BrandKitRadii;
  motion?: BrandKitMotion;
  logos?: BrandKitLogos;
};

export type ResolvedBrandKitTokens = {
  backgroundColor?: string;
  surfaceColor?: string;
  textColor?: string;
  accentColor?: string;
  borderColor?: string;
  mutedColor?: string;
  fontFamily?: string;
  headingFontFamily?: string;
  bodyFontFamily?: string;
  borderRadius?: number;
  animationDurationMs?: number;
  animationEasing?: string;
  logoUrl?: string;
};

export type BrandKitTargetSlot =
  | 'backgroundColor'
  | 'surfaceColor'
  | 'textColor'
  | 'accentColor'
  | 'borderColor'
  | 'fontFamily'
  | 'headingFontFamily'
  | 'bodyFontFamily'
  | 'borderRadius'
  | 'animationDurationMs'
  | 'animationEasing';
