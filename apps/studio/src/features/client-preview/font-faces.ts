import { buildResolvedWidgetsById } from '../../domain/document/canvas-variants';
import type { StudioState } from '../../domain/document/types';

export type ClientPreviewFontFace = {
  family: string;
  src: string;
};

export function collectClientPreviewFontFaces(state: StudioState): ClientPreviewFontFace[] {
  const seen = new Set<string>();

  return Object.values(buildResolvedWidgetsById(state.document))
    .map((widget) => {
      const family = String(widget.style.fontFamily ?? '').trim();
      const src = String(widget.props.fontAssetSrc ?? '').trim();
      return family && src ? { family, src } : null;
    })
    .filter((value): value is ClientPreviewFontFace => Boolean(value))
    .filter(({ family, src }) => {
      const key = `${family}::${src}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}
