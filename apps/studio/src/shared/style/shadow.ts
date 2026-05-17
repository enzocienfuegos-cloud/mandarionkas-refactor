export type ShadowConfig = {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
};

export const DEFAULT_SHADOW: ShadowConfig = Object.freeze({
  enabled: false,
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color: 'rgba(0, 0, 0, 0.25)',
  inset: false,
});

export function shadowConfigToBoxShadow(config: ShadowConfig | undefined | null): string {
  if (!config?.enabled) return 'none';
  const { offsetX, offsetY, blur, spread, color, inset } = config;
  return `${inset ? 'inset ' : ''}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
}

export function shadowConfigToTextShadow(config: ShadowConfig | undefined | null): string {
  if (!config?.enabled) return 'none';
  const { offsetX, offsetY, blur, color } = config;
  return `${offsetX}px ${offsetY}px ${blur}px ${color}`;
}

export function readShadowFromStyle(style: Record<string, unknown> | undefined): ShadowConfig {
  const raw = style?.shadow;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SHADOW };
  }
  const shadow = raw as Partial<ShadowConfig>;
  return {
    enabled: Boolean(shadow.enabled),
    offsetX: Number.isFinite(Number(shadow.offsetX)) ? Number(shadow.offsetX) : DEFAULT_SHADOW.offsetX,
    offsetY: Number.isFinite(Number(shadow.offsetY)) ? Number(shadow.offsetY) : DEFAULT_SHADOW.offsetY,
    blur: Number.isFinite(Number(shadow.blur)) ? Math.max(0, Number(shadow.blur)) : DEFAULT_SHADOW.blur,
    spread: Number.isFinite(Number(shadow.spread)) ? Number(shadow.spread) : DEFAULT_SHADOW.spread,
    color: typeof shadow.color === 'string' && shadow.color.trim() ? shadow.color : DEFAULT_SHADOW.color,
    inset: Boolean(shadow.inset),
  };
}
