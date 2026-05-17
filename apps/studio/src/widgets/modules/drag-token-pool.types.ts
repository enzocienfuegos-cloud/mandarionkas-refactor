export type TokenShape = 'circle' | 'square' | 'rounded';

export type DragTokenItem = {
  id: string;
  label: string;
  assetId?: string;
  imageUrl?: string;
  accentColor?: string;
  baseAssetId?: string;
  baseImageUrl?: string;
};

export const MIN_TOKENS = 1;
export const MAX_TOKENS = 12;
export const TOKEN_SIZE_MIN = 48;
export const TOKEN_SIZE_MAX = 160;
export const DEFAULT_TOKEN_SHAPE: TokenShape = 'circle';

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
