export type BrandKitColorTokensDto = {
  background?: string;
  surface?: string;
  text?: string;
  accent?: string;
  border?: string;
  muted?: string;
};

export type BrandKitTypographyDto = {
  fontFamily?: string;
  headingFamily?: string;
  bodyFamily?: string;
  baseSizePx?: number;
  weightRegular?: number;
  weightStrong?: number;
};

export type BrandKitRadiiDto = {
  sm?: number;
  md?: number;
  lg?: number;
  pill?: number;
};

export type BrandKitMotionDto = {
  durationMs?: number;
  easing?: string;
};

export type BrandKitLogosDto = {
  primaryUrl?: string;
  secondaryUrl?: string;
  iconUrl?: string;
};

export type BrandKitDto = {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  brandId?: string;
  brandName?: string;
  colors?: BrandKitColorTokensDto;
  typography?: BrandKitTypographyDto;
  radii?: BrandKitRadiiDto;
  motion?: BrandKitMotionDto;
  logos?: BrandKitLogosDto;
  createdAt: string;
  updatedAt: string;
};

export type BrandKitDraftDto = {
  name: string;
  description?: string;
  brandId?: string;
  brandName?: string;
  colors?: BrandKitColorTokensDto;
  typography?: BrandKitTypographyDto;
  radii?: BrandKitRadiiDto;
  motion?: BrandKitMotionDto;
  logos?: BrandKitLogosDto;
};

export type ListBrandKitsResponseDto = { brandKits: BrandKitDto[] };
export type GetBrandKitResponseDto = { brandKit: BrandKitDto | null };
export type CreateBrandKitRequestDto = { brandKit: BrandKitDraftDto };
export type UpdateBrandKitRequestDto = { brandKit: BrandKitDraftDto };
export type SaveBrandKitResponseDto = { brandKit: BrandKitDto };
export type DeleteBrandKitResponseDto = { ok: true };
