export type TokenShape = 'circle' | 'square' | 'rounded';
export type TokenImageFit = 'contain' | 'cover' | 'fill' | 'scale-down';

export type DragTokenItem = {
  id: string;
  label: string;
  assetId?: string;
  imageUrl?: string;
  accentColor?: string;
  baseAssetId?: string;
  baseImageUrl?: string;
  baseImageFit?: TokenImageFit;
};

export const MIN_TOKENS = 1;
export const MAX_TOKENS = 12;
export const TOKEN_SIZE_MIN = 48;
export const TOKEN_SIZE_MAX = 160;
export const DEFAULT_TOKEN_SHAPE: TokenShape = 'circle';
export const DEFAULT_TOKEN_IMAGE_FIT: TokenImageFit = 'contain';
export const TOKEN_IMAGE_MAX_SIZE_PERCENT_MIN = 40;
export const TOKEN_IMAGE_MAX_SIZE_PERCENT_MAX = 100;
export const DEFAULT_TOKEN_IMAGE_MAX_SIZE_PERCENT = 82;
export const TOKEN_IMAGE_FIT_OPTIONS: ReadonlyArray<TokenImageFit> = ['contain', 'cover', 'fill', 'scale-down'];

export function generateTokenId(): string {
  return `tok_${Math.random().toString(36).slice(2, 10)}`;
}

export function tokenShapeToBorderRadius(shape: TokenShape): string {
  switch (shape) {
    case 'square':
      return '0';
    case 'rounded':
      return '12px';
    case 'circle':
    default:
      return '50%';
  }
}

export function clampTokenImageMaxSizePercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TOKEN_IMAGE_MAX_SIZE_PERCENT;
  return Math.max(TOKEN_IMAGE_MAX_SIZE_PERCENT_MIN, Math.min(TOKEN_IMAGE_MAX_SIZE_PERCENT_MAX, Math.round(numeric)));
}

export function normalizeTokenImageFit(value: unknown): TokenImageFit {
  return TOKEN_IMAGE_FIT_OPTIONS.includes(value as TokenImageFit)
    ? value as TokenImageFit
    : DEFAULT_TOKEN_IMAGE_FIT;
}
