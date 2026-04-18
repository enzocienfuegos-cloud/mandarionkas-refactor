import type { CSSProperties } from 'react';
import type { WidgetNode } from '../../domain/document/types';

export type SupportedShape = 'rectangle' | 'square' | 'circle' | 'triangle' | 'line' | 'arrow';

export function resolveShapeKind(node: WidgetNode): SupportedShape {
  const shape = String(node.props.shape ?? 'rectangle');
  if (shape === 'square' || shape === 'circle' || shape === 'triangle' || shape === 'line' || shape === 'arrow') return shape;
  return 'rectangle';
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
