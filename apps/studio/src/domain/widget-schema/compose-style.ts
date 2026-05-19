import type { CSSProperties } from 'react';
import type { WidgetNode } from '../document/types';

export type StyleTarget = 'editor' | 'export-inline-string';

// ---------------------------------------------------------------------------
// Alignment
// ---------------------------------------------------------------------------

export type WidgetAlignment = {
  horizontal: 'flex-start' | 'center' | 'flex-end';
  vertical: 'flex-start' | 'center' | 'flex-end';
  text: 'left' | 'center' | 'right';
};

export function composeWidgetAlignment(node: WidgetNode): WidgetAlignment {
  const hRaw = String(node.style.horizontalAlign ?? node.style.textAlign ?? 'center');
  const vRaw = String(node.style.verticalAlign ?? 'center');

  let horizontal: 'flex-start' | 'center' | 'flex-end';
  if (hRaw === 'left') horizontal = 'flex-start';
  else if (hRaw === 'right') horizontal = 'flex-end';
  else horizontal = 'center';

  let vertical: 'flex-start' | 'center' | 'flex-end';
  if (vRaw === 'top') vertical = 'flex-start';
  else if (vRaw === 'bottom') vertical = 'flex-end';
  else vertical = 'center';

  const text: 'left' | 'center' | 'right' =
    hRaw === 'left' || hRaw === 'right' ? hRaw : 'center';

  return { horizontal, vertical, text };
}

// ---------------------------------------------------------------------------
// Typography helpers (shared logic)
// ---------------------------------------------------------------------------

function resolveFontWeightCss(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '700';
}

function resolveLineHeightCss(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) return value.trim();
  return '1.1';
}

function resolveLetterSpacingCss(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value}px`;
  if (typeof value === 'string' && value.trim()) {
    if (value.trim().toLowerCase() === 'normal') return 'normal';
    const numeric = Number(value);
    return Number.isFinite(numeric) ? `${numeric}px` : value.trim();
  }
  return 'normal';
}

// ---------------------------------------------------------------------------
// Typography — editor target returns CSSProperties
// ---------------------------------------------------------------------------

function composeTypographyEditor(node: WidgetNode): CSSProperties {
  const style = node.style;

  const rawWeight = style.fontWeight;
  let fontWeight: CSSProperties['fontWeight'];
  if (typeof rawWeight === 'number') fontWeight = rawWeight;
  else if (typeof rawWeight === 'string' && rawWeight.trim()) {
    const numeric = Number(rawWeight);
    fontWeight = Number.isFinite(numeric) ? numeric : rawWeight;
  } else {
    fontWeight = 700;
  }

  const rawLineHeight = style.lineHeight;
  let lineHeight: CSSProperties['lineHeight'];
  if (typeof rawLineHeight === 'number') lineHeight = rawLineHeight;
  else if (typeof rawLineHeight === 'string' && rawLineHeight.trim()) {
    const numeric = Number(rawLineHeight);
    lineHeight = Number.isFinite(numeric) ? numeric : rawLineHeight;
  } else {
    lineHeight = 1.1;
  }

  const rawLetterSpacing = style.letterSpacing;
  let letterSpacing: CSSProperties['letterSpacing'];
  if (typeof rawLetterSpacing === 'number' && Number.isFinite(rawLetterSpacing)) {
    letterSpacing = `${rawLetterSpacing}px`;
  } else if (typeof rawLetterSpacing === 'string' && rawLetterSpacing.trim()) {
    if (rawLetterSpacing.trim().toLowerCase() === 'normal') {
      letterSpacing = 'normal';
    } else {
      const numeric = Number(rawLetterSpacing);
      letterSpacing = Number.isFinite(numeric) ? `${numeric}px` : rawLetterSpacing;
    }
  } else {
    letterSpacing = 'normal';
  }

  return {
    fontWeight,
    lineHeight,
    letterSpacing,
    fontSize: Number(style.fontSize ?? 18),
    fontFamily: String(style.fontFamily ?? 'inherit'),
    fontStyle: String(style.fontStyle ?? 'normal') as CSSProperties['fontStyle'],
    textTransform: String(style.textTransform ?? 'none') as CSSProperties['textTransform'],
    textDecoration: String(style.textDecoration ?? 'none'),
  };
}

// ---------------------------------------------------------------------------
// Typography — export-inline-string target returns CSS string
// ---------------------------------------------------------------------------

function composeTypographyInlineString(node: WidgetNode): string {
  const style = node.style;
  return [
    `font-weight:${resolveFontWeightCss(style.fontWeight)}`,
    `line-height:${resolveLineHeightCss(style.lineHeight)}`,
    `letter-spacing:${resolveLetterSpacingCss(style.letterSpacing)}`,
    `font-size:${Number(style.fontSize ?? 18)}px`,
    `font-family:${String(style.fontFamily ?? 'inherit')}`,
    `font-style:${String(style.fontStyle ?? 'normal')}`,
    `text-transform:${String(style.textTransform ?? 'none')}`,
    `text-decoration:${String(style.textDecoration ?? 'none')}`,
  ].join(';');
}

// ---------------------------------------------------------------------------
// composeWidgetTypography — public API
// ---------------------------------------------------------------------------

export function composeWidgetTypography(node: WidgetNode, target: 'editor'): CSSProperties;
export function composeWidgetTypography(node: WidgetNode, target: 'export-inline-string'): string;
export function composeWidgetTypography(
  node: WidgetNode,
  target: StyleTarget,
): CSSProperties | string {
  if (target === 'export-inline-string') return composeTypographyInlineString(node);
  return composeTypographyEditor(node);
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export type WidgetFrameLayout = {
  left: number;
  top: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
};

export function composeWidgetFrame(node: WidgetNode): WidgetFrameLayout {
  const { x, y, width, height, rotation } = node.frame;
  return {
    left: x,
    top: y,
    width,
    height,
    rotation,
    opacity: Number(node.style.opacity ?? 1),
  };
}
