export type TokenShape = 'circle' | 'square' | 'rounded';
export type TokenImageFit = 'contain' | 'cover' | 'fill' | 'scale-down';

export type DragTokenItem = {
  id: string;
  label: string;
  targetSceneId?: string;
  targetActionId?: string;
  assetId?: string;
  imageUrl?: string;
  accentColor?: string;
  baseAssetId?: string;
  baseImageUrl?: string;
  baseImageFit?: TokenImageFit;
  baseImageScalePercent?: number;
  baseImageFocalX?: number;
  baseImageFocalY?: number;
};

function normalizeDragTokenItem(raw: unknown): DragTokenItem | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const item = raw as Record<string, unknown>;
  const id = String(item.id ?? '').trim();
  if (!id) return undefined;
  const label = String(item.label ?? id).trim() || id;
  // Templates (e.g. world-cup) store the image in a 'src' field; normalise it into imageUrl
  const resolvedImageUrl =
    (typeof item.imageUrl === 'string' && item.imageUrl.trim() ? item.imageUrl.trim() : undefined)
    ?? (typeof item.src === 'string' && item.src.trim() ? item.src.trim() : undefined);
  return {
    ...(item as DragTokenItem),
    id,
    label,
    imageUrl: resolvedImageUrl ?? (item as DragTokenItem).imageUrl,
    targetSceneId: typeof item.targetSceneId === 'string' && item.targetSceneId.trim() ? item.targetSceneId : undefined,
    targetActionId: typeof item.targetActionId === 'string' && item.targetActionId.trim() ? item.targetActionId : undefined,
  };
}

export function parseDragTokenItems(raw: unknown): DragTokenItem[] {
  const value = typeof raw === 'string'
    ? (() => {
        try {
          return JSON.parse(raw) as unknown;
        } catch {
          return [];
        }
      })()
    : raw;
  if (!Array.isArray(value)) return [];
  return value.map(normalizeDragTokenItem).filter((item): item is DragTokenItem => Boolean(item));
}

export const MIN_TOKENS = 1;
export const MAX_TOKENS = 12;
export const TOKEN_SIZE_MIN = 48;
export const TOKEN_SIZE_MAX = 160;
export const DEFAULT_TOKEN_SHAPE: TokenShape = 'circle';
export const DEFAULT_TOKEN_IMAGE_FIT: TokenImageFit = 'contain';
export const DEFAULT_TOKEN_IMAGE_SCALE_PERCENT = 100;
export const TOKEN_IMAGE_SCALE_PERCENT_MIN = 50;
export const TOKEN_IMAGE_SCALE_PERCENT_MAX = 200;
export const DEFAULT_TOKEN_IMAGE_FOCAL_X = 50;
export const DEFAULT_TOKEN_IMAGE_FOCAL_Y = 50;
export const TOKEN_IMAGE_FOCAL_MIN = 0;
export const TOKEN_IMAGE_FOCAL_MAX = 100;
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

export function clampTokenImageScalePercent(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_TOKEN_IMAGE_SCALE_PERCENT;
  return Math.max(TOKEN_IMAGE_SCALE_PERCENT_MIN, Math.min(TOKEN_IMAGE_SCALE_PERCENT_MAX, Math.round(numeric)));
}

export function clampTokenImageFocal(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(TOKEN_IMAGE_FOCAL_MIN, Math.min(TOKEN_IMAGE_FOCAL_MAX, Math.round(numeric)));
}
