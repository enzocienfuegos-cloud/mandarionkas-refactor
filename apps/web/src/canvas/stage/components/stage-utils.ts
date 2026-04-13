import type { CSSProperties } from 'react';
import type { WidgetFrame } from '../../../domain/document/types';

export function sceneTransitionOpacity(type: 'cut' | 'fade' | 'slide-left' | 'slide-right', active: boolean): number {
  if (!active || type === 'cut') return 1;
  return 0.94;
}

export function sceneTransitionTransform(type: 'cut' | 'fade' | 'slide-left' | 'slide-right', active: boolean): string {
  if (!active || type === 'cut' || type === 'fade') return 'translate3d(0,0,0)';
  return type === 'slide-left' ? 'translate3d(-10px,0,0)' : 'translate3d(10px,0,0)';
}

export function toRect(origin: { x: number; y: number }, current: { x: number; y: number }): WidgetFrame {
  return {
    x: Math.min(origin.x, current.x),
    y: Math.min(origin.y, current.y),
    width: Math.abs(current.x - origin.x),
    height: Math.abs(current.y - origin.y),
    rotation: 0,
  };
}

export function rectStyle(rect: WidgetFrame): CSSProperties {
  return { left: rect.x, top: rect.y, width: rect.width, height: rect.height };
}
