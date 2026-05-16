import { useEffect, useMemo } from 'react';
import { buildResolvedWidgetsById } from '../domain/document/canvas-variants';
import { listAssets } from '../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../repositories/asset/events';
import { usePlatformSnapshot } from '../platform/runtime';
import { useStudioStore } from '../core/store/use-studio-store';
import { buildFontAssetCss, buildFontFaceCss } from './font-family';

export function FontAssetRuntime(): JSX.Element | null {
  const platform = usePlatformSnapshot();
  const linkedFonts = useStudioStore((state) => Object.values(buildResolvedWidgetsById(state.document))
    .map((widget) => {
      const family = String(widget.style.fontFamily ?? '').trim();
      const src = String(widget.props.fontAssetSrc ?? '').trim();
      return family && src ? { family, src } : null;
    })
    .filter((value): value is { family: string; src: string } => Boolean(value)));

  const linkedFontCss = useMemo(() => {
    const seen = new Set<string>();
    return linkedFonts
      .filter(({ family, src }) => {
        const key = `${family}::${src}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(({ family, src }) => buildFontFaceCss(family, src))
      .join('\n');
  }, [linkedFonts]);

  useEffect(() => {
    let cancelled = false;
    const styleId = 'smx-runtime-font-assets';

    const writeCss = (assetCss: string) => {
      let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.id = styleId;
        document.head.appendChild(styleEl);
      }
      styleEl.textContent = [assetCss, linkedFontCss].filter(Boolean).join('\n');
    };

    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      writeCss('');
      return;
    }

    const syncFonts = () => {
      void listAssets()
        .then((assets) => {
          if (cancelled) return;
          const fontAssets = assets.filter((asset) => asset.kind === 'font');
          writeCss(fontAssets.map(buildFontAssetCss).join('\n'));
        })
        .catch(() => {
          if (cancelled) return;
          writeCss('');
        });
    };

    syncFonts();
    const unsubscribe = subscribeToAssetLibraryChanges(syncFonts);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [linkedFontCss, platform.session.isAuthenticated, platform.session.sessionId]);

  return null;
}
