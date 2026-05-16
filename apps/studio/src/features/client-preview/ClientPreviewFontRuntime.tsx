import { useEffect, useMemo } from 'react';
import { buildFontFaceCss } from '../../assets/font-family';
import type { StudioState } from '../../domain/document/types';
import { collectClientPreviewFontFaces } from './font-faces';

const STYLE_ID = 'smx-client-preview-font-assets';

export function ClientPreviewFontRuntime({ state }: { state: StudioState }): JSX.Element | null {
  const fontCss = useMemo(
    () => collectClientPreviewFontFaces(state).map(({ family, src }) => buildFontFaceCss(family, src)).join('\n'),
    [state],
  );

  useEffect(() => {
    let styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = fontCss;

    return () => {
      if (styleEl?.parentNode) styleEl.parentNode.removeChild(styleEl);
    };
  }, [fontCss]);

  return null;
}
