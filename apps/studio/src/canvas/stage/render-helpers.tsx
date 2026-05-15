import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from './render-context';

export const DEFAULT_WIDGET_TEXT_COLOR = '#ffffff';
export const DEFAULT_WIDGET_BACKGROUND_DARK = '#1f2937';
export const DEFAULT_WIDGET_HOVER_ACCENT = '#f59e0b';
export const DEFAULT_WIDGET_BORDER_COLOR = 'rgba(255,255,255,0.12)';
export const DEFAULT_WIDGET_SHADOW = '0 14px 30px rgba(0,0,0,0.18)';
export const DEFAULT_WIDGET_HOVER_SHADOW = '0 18px 34px rgba(0,0,0,0.28)';

export const resolveWidgetColor = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeColor) return String(node.style.activeColor);
  if (ctx?.hovered && node.style.hoverColor) return String(node.style.hoverColor);
  return String(node.style.color ?? DEFAULT_WIDGET_TEXT_COLOR);
};

export const resolveWidgetBackground = (node: WidgetNode, fallback: string, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBackgroundColor) return String(node.style.activeBackgroundColor);
  if (ctx?.hovered && node.style.hoverBackgroundColor) return String(node.style.hoverBackgroundColor);
  return String(node.style.backgroundColor ?? fallback);
};

export const resolveWidgetBorder = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBorderColor) return String(node.style.activeBorderColor);
  if (ctx?.hovered && node.style.hoverBorderColor) return String(node.style.hoverBorderColor);
  if (ctx?.hovered) return String(node.style.accentColor ?? DEFAULT_WIDGET_HOVER_ACCENT);
  return DEFAULT_WIDGET_BORDER_COLOR;
};

export const resolveWidgetOpacity = (node: WidgetNode, ctx?: RenderContext): number => {
  if (ctx?.active && node.style.activeOpacity != null) return Number(node.style.activeOpacity);
  if (ctx?.hovered && node.style.hoverOpacity != null) return Number(node.style.hoverOpacity);
  return Number(node.style.opacity ?? 1);
};

export const resolveWidgetShadow = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeShadow) return String(node.style.activeShadow);
  if (ctx?.hovered && node.style.hoverShadow) return String(node.style.hoverShadow);
  return ctx?.hovered ? DEFAULT_WIDGET_HOVER_SHADOW : DEFAULT_WIDGET_SHADOW;
};

function resolveFontWeight(value: unknown): CSSProperties['fontWeight'] {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return 700;
}

function resolveLineHeight(value: unknown): CSSProperties['lineHeight'] {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim()) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : value;
  }
  return 1.1;
}

export const baseTextStyle = (node: WidgetNode, ctx?: RenderContext): CSSProperties => ({
  color: resolveWidgetColor(node, ctx),
  fontSize: Number(node.style.fontSize ?? 18),
  fontWeight: resolveFontWeight(node.style.fontWeight),
  fontFamily: String(node.style.fontFamily ?? 'inherit'),
  fontStyle: String(node.style.fontStyle ?? 'normal'),
  lineHeight: resolveLineHeight(node.style.lineHeight),
  letterSpacing: String(node.style.letterSpacing ?? 'normal'),
  textTransform: String(node.style.textTransform ?? 'none') as CSSProperties['textTransform'],
  textDecoration: String(node.style.textDecoration ?? 'none'),
  opacity: resolveWidgetOpacity(node, ctx),
});

export const resolveTextHorizontalAlign = (node: WidgetNode): 'flex-start' | 'center' | 'flex-end' => {
  const align = String(node.style.horizontalAlign ?? node.style.textAlign ?? 'center');
  if (align === 'left') return 'flex-start';
  if (align === 'right') return 'flex-end';
  return 'center';
};

export const resolveTextVerticalAlign = (node: WidgetNode): 'flex-start' | 'center' | 'flex-end' => {
  const align = String(node.style.verticalAlign ?? 'center');
  if (align === 'top') return 'flex-start';
  if (align === 'bottom') return 'flex-end';
  return 'center';
};

export const resolveCssTextAlign = (node: WidgetNode): 'left' | 'center' | 'right' => {
  const align = String(node.style.horizontalAlign ?? node.style.textAlign ?? 'center');
  if (align === 'left' || align === 'right') return align;
  return 'center';
};
