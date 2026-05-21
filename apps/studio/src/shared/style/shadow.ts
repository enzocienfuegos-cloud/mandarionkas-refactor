export type ShadowConfig = {
  enabled: boolean;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  color: string;
  inset: boolean;
  /**
   * Number of box-shadow layers (1–5). With layers > 1 the single shadow is split
   * into N layers that graduate from a tight, dense core shadow to a wide, diffuse
   * ambient shadow — matching how real light behaves and avoiding the "boxy" look.
   * All layers use standard box-shadow so compatibility with iOS and playable ads
   * is identical to a single-layer shadow.
   */
  layers: number;
};

export const DEFAULT_SHADOW: ShadowConfig = Object.freeze({
  enabled: false,
  offsetX: 0,
  offsetY: 4,
  blur: 12,
  spread: 0,
  color: 'rgba(0, 0, 0, 0.25)',
  inset: false,
  layers: 1,
});

export const SHADOW_LAYERS_MIN = 1;
export const SHADOW_LAYERS_MAX = 5;

/**
 * Parse a CSS color string into its RGBA components.
 * Supports: rgba(), rgb(), #RRGGBB, #RRGGBBAA.
 * Returns null for formats we can't decompose (named colors, hsl, etc.).
 */
function parseRgba(color: string): { r: number; g: number; b: number; a: number } | null {
  // rgba(r, g, b, a) or rgb(r, g, b)
  const rgbaMatch = color.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i,
  );
  if (rgbaMatch) {
    return {
      r: parseInt(rgbaMatch[1], 10),
      g: parseInt(rgbaMatch[2], 10),
      b: parseInt(rgbaMatch[3], 10),
      a: rgbaMatch[4] !== undefined ? Math.min(1, Math.max(0, parseFloat(rgbaMatch[4]))) : 1,
    };
  }
  // #RRGGBBAA
  const hex8 = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex8) {
    return {
      r: parseInt(hex8[1], 16),
      g: parseInt(hex8[2], 16),
      b: parseInt(hex8[3], 16),
      a: parseInt(hex8[4], 16) / 255,
    };
  }
  // #RRGGBB
  const hex6 = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex6) {
    return {
      r: parseInt(hex6[1], 16),
      g: parseInt(hex6[2], 16),
      b: parseInt(hex6[3], 16),
      a: 1,
    };
  }
  return null;
}

/**
 * Build a box-shadow CSS value from a ShadowConfig.
 *
 * With layers = 1 (default): identical output to the original implementation.
 *
 * With layers > 1: generates N shadows that graduate from a tight, opaque core
 * shadow to a wide, transparent ambient shadow. The total visual alpha is
 * distributed across layers using a descending triangular weighting so the
 * perceived intensity stays close to the single-layer equivalent.
 *
 * Algorithm:
 *   for layer i (0-indexed) of N total:
 *     t        = (i + 1) / N           — fraction of full offset/blur/spread
 *     weight_i = (N - i) / Σ(1..N)     — descending; first layer heaviest
 *     alpha_i  = baseAlpha × weight_i
 */
export function shadowConfigToBoxShadow(config: ShadowConfig | undefined | null): string {
  if (!config?.enabled) return 'none';
  const { offsetX, offsetY, blur, spread, color, inset, layers = 1 } = config;
  const prefix = inset ? 'inset ' : '';
  const n = Math.max(SHADOW_LAYERS_MIN, Math.min(SHADOW_LAYERS_MAX, Math.round(layers)));

  if (n <= 1) {
    return `${prefix}${offsetX}px ${offsetY}px ${blur}px ${spread}px ${color}`;
  }

  const parsed = parseRgba(color);
  // Triangular weight denominator: 1 + 2 + … + N = N*(N+1)/2
  const weightSum = (n * (n + 1)) / 2;
  const parts: string[] = [];

  for (let i = 0; i < n; i++) {
    const t = (i + 1) / n;
    const layerOffsetX = Math.round(offsetX * t);
    const layerOffsetY = Math.round(offsetY * t);
    const layerBlur = Math.round(blur * t);
    const layerSpread = spread !== 0 ? Math.round(spread * t) : 0;

    let layerColor: string;
    if (parsed) {
      // Descending weight: layer 0 → N/(sum), layer N-1 → 1/(sum)
      const weight = (n - i) / weightSum;
      const layerAlpha = Math.min(1, parsed.a * weight * n);
      layerColor = `rgba(${parsed.r},${parsed.g},${parsed.b},${layerAlpha.toFixed(3)})`;
    } else {
      // Color format we can't parse — use as-is for every layer
      layerColor = color;
    }

    parts.push(`${prefix}${layerOffsetX}px ${layerOffsetY}px ${layerBlur}px ${layerSpread}px ${layerColor}`);
  }

  return parts.join(', ');
}

export function shadowConfigToTextShadow(config: ShadowConfig | undefined | null): string {
  if (!config?.enabled) return 'none';
  const { offsetX, offsetY, blur, color } = config;
  // Text shadows don't support spread or inset; layers not applicable here.
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
    layers: Number.isFinite(Number(shadow.layers)) && Number(shadow.layers) >= SHADOW_LAYERS_MIN
      ? Math.min(SHADOW_LAYERS_MAX, Math.round(Number(shadow.layers)))
      : DEFAULT_SHADOW.layers,
  };
}
