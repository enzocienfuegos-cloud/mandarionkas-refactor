import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from './render-context';
import { composeWidgetAlignment, composeWidgetTypography } from '../../domain/widget-schema/compose-style';

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

export const baseTextStyle = (node: WidgetNode, ctx?: RenderContext): CSSProperties => ({
  color: resolveWidgetColor(node, ctx),
  ...composeWidgetTypography(node, 'editor'),
  opacity: resolveWidgetOpacity(node, ctx),
});

/** @deprecated use composeWidgetAlignment */
export const resolveTextHorizontalAlign = (node: WidgetNode): 'flex-start' | 'center' | 'flex-end' =>
  composeWidgetAlignment(node).horizontal;

/** @deprecated use composeWidgetAlignment */
export const resolveTextVerticalAlign = (node: WidgetNode): 'flex-start' | 'center' | 'flex-end' =>
  composeWidgetAlignment(node).vertical;

/** @deprecated use composeWidgetAlignment */
export const resolveCssTextAlign = (node: WidgetNode): 'left' | 'center' | 'right' =>
  composeWidgetAlignment(node).text;
