export type CornerStyle = 'square' | 'rounded' | 'pill';

type CornerNodeLike = {
  props?: Record<string, unknown>;
  style?: Record<string, unknown>;
  frame?: { width: number; height: number };
};

export function resolveCornerRadius(node: CornerNodeLike, defaultRadius: number): number {
  const cornerStyle = String(node.props?.cornerStyle ?? 'rounded') as CornerStyle;
  if (cornerStyle === 'square') return 0;
  if (cornerStyle === 'pill') {
    const width = Number(node.frame?.width ?? 0);
    const height = Number(node.frame?.height ?? 0);
    return Math.max(999, Math.min(width, height) / 2 || defaultRadius);
  }
  return Number(node.style?.borderRadius ?? defaultRadius);
}
