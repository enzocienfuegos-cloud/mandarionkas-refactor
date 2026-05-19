import { isTransparentPaint, isPlainWhite } from './paint-utils';

export type ScratchCoverSource = {
  explicitCoverColor: string;
  backgroundColor: string;
  accentColor: string;
};

export function resolveScratchCoverColor(source: ScratchCoverSource): string {
  if (!isTransparentPaint(source.explicitCoverColor)) return source.explicitCoverColor;
  if (!isTransparentPaint(source.backgroundColor)) return source.backgroundColor;
  if (!isTransparentPaint(source.accentColor) && !isPlainWhite(source.accentColor)) return source.accentColor;
  return 'rgba(245, 158, 11, 0.94)';
}
