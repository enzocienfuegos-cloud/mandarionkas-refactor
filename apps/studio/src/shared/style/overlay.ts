/**
 * Color overlay applied on top of image widgets to improve text legibility
 * when the image is used as a background.
 *
 * Rendered as `position:absolute;inset:0` so it sits above the <img> but
 * inherits the parent's border-radius and never intercepts pointer events.
 */
export type OverlayConfig = {
  enabled: boolean;
  /** Pure color (no alpha). Opacity is controlled separately via `opacity`. */
  color: string;
  /** 0 = fully transparent, 1 = fully opaque. */
  opacity: number;
};

export const DEFAULT_OVERLAY: OverlayConfig = Object.freeze({
  enabled: false,
  color: '#000000',
  opacity: 0.4,
});

export const OVERLAY_OPACITY_MIN = 0;
export const OVERLAY_OPACITY_MAX = 1;

export function readOverlayFromStyle(style: Record<string, unknown> | undefined): OverlayConfig {
  const raw = style?.overlay;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...DEFAULT_OVERLAY };
  const o = raw as Partial<OverlayConfig>;
  return {
    enabled: Boolean(o.enabled),
    color: typeof o.color === 'string' && o.color.trim() ? o.color.trim() : DEFAULT_OVERLAY.color,
    opacity: Number.isFinite(Number(o.opacity))
      ? Math.max(OVERLAY_OPACITY_MIN, Math.min(OVERLAY_OPACITY_MAX, Number(o.opacity)))
      : DEFAULT_OVERLAY.opacity,
  };
}

/** Inline style string for the overlay div (export renderer). */
export function overlayToInlineStyle(config: OverlayConfig | undefined | null, borderRadius: number | string = 0): string {
  if (!config?.enabled) return '';
  return `position:absolute;inset:0;background:${config.color};opacity:${config.opacity};pointer-events:none;border-radius:${typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius};`;
}

/** React CSSProperties for the overlay div (stage renderer). */
export function overlayToCssProperties(config: OverlayConfig | undefined | null): React.CSSProperties | null {
  if (!config?.enabled) return null;
  return {
    position: 'absolute',
    inset: 0,
    background: config.color,
    opacity: config.opacity,
    pointerEvents: 'none',
    borderRadius: 'inherit',
  };
}
