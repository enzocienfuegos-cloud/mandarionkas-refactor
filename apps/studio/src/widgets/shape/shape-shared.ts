import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';

export type SupportedShape = 'rectangle' | 'square' | 'circle' | 'triangle' | 'line' | 'arrow';

export function resolveShapeKind(node: WidgetNode): SupportedShape {
  const shape = String(node.props.shape ?? 'rectangle');
  if (shape === 'square' || shape === 'circle' || shape === 'triangle' || shape === 'line' || shape === 'arrow') return shape;
  return 'rectangle';
}

/**
 * Returns a CSS clip-path string for shapes that support image masking,
 * or null for shapes that can't be clipped (line, arrow use background directly).
 */
export function buildShapeClipPath(node: WidgetNode): string | null {
  const shape = resolveShapeKind(node);
  if (shape === 'circle') return 'circle(50% at 50% 50%)';
  if (shape === 'triangle') return 'polygon(50% 0%, 0% 100%, 100% 100%)';
  if (shape === 'rectangle') return 'inset(0 round 0px)';
  if (shape === 'square') return 'inset(0 round 0px)';
  return null; // line and arrow don't support image mask
}

export function buildShapeInnerStyle(node: WidgetNode, fill: string): CSSProperties {
  const width = Number(node.frame.width ?? 0);
  const height = Number(node.frame.height ?? 0);
  const minSide = Math.max(0, Math.min(width, height));
  const shape = resolveShapeKind(node);

  if (shape === 'square') {
    return {
      width: minSide,
      height: minSide,
      background: fill,
    };
  }

  if (shape === 'circle') {
    return {
      width: minSide,
      height: minSide,
      background: fill,
      borderRadius: '50%',
    };
  }

  if (shape === 'triangle') {
    return {
      width: '100%',
      height: '100%',
      background: fill,
      clipPath: 'polygon(50% 0%, 0% 100%, 100% 100%)',
    };
  }

  if (shape === 'line') {
    return {
      width: '100%',
      height: Math.max(4, Math.min(10, height * 0.12)),
      background: fill,
      borderRadius: 999,
    };
  }

  if (shape === 'arrow') {
    return {
      width: '100%',
      height: '100%',
      background: fill,
      clipPath: 'polygon(0% 35%, 64% 35%, 64% 14%, 100% 50%, 64% 86%, 64% 65%, 0% 65%)',
    };
  }

  return {
    width: '100%',
    height: '100%',
    background: fill,
    borderRadius: 16,
  };
}
