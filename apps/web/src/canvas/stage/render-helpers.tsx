import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';
import type { RenderContext } from './render-context';

export const resolveWidgetColor = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeColor) return String(node.style.activeColor);
  if (ctx?.hovered && node.style.hoverColor) return String(node.style.hoverColor);
  return String(node.style.color ?? '#fff');
};

export const resolveWidgetBackground = (node: WidgetNode, fallback: string, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBackgroundColor) return String(node.style.activeBackgroundColor);
  if (ctx?.hovered && node.style.hoverBackgroundColor) return String(node.style.hoverBackgroundColor);
  return String(node.style.backgroundColor ?? fallback);
};

export const resolveWidgetBorder = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeBorderColor) return String(node.style.activeBorderColor);
  if (ctx?.hovered && node.style.hoverBorderColor) return String(node.style.hoverBorderColor);
  if (ctx?.hovered) return String(node.style.accentColor ?? '#f59e0b');
  return 'rgba(255,255,255,0.12)';
};

export const resolveWidgetOpacity = (node: WidgetNode, ctx?: RenderContext): number => {
  if (ctx?.active && node.style.activeOpacity != null) return Number(node.style.activeOpacity);
  if (ctx?.hovered && node.style.hoverOpacity != null) return Number(node.style.hoverOpacity);
  return Number(node.style.opacity ?? 1);
};

export const resolveWidgetShadow = (node: WidgetNode, ctx?: RenderContext): string => {
  if (ctx?.active && node.style.activeShadow) return String(node.style.activeShadow);
  if (ctx?.hovered && node.style.hoverShadow) return String(node.style.hoverShadow);
  return ctx?.hovered ? '0 18px 34px rgba(0,0,0,0.28)' : '0 14px 30px rgba(0,0,0,0.18)';
};

export const baseTextStyle = (node: WidgetNode, ctx?: RenderContext): CSSProperties => ({
  color: resolveWidgetColor(node, ctx),
  fontSize: Number(node.style.fontSize ?? 18),
  fontWeight: Number(node.style.fontWeight ?? 700),
  fontFamily: String(node.style.fontFamily ?? 'inherit'),
  lineHeight: 1.1,
  opacity: resolveWidgetOpacity(node, ctx),
});
