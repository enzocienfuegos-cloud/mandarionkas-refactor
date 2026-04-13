import { useEffect } from 'react';
import { listAssets } from '../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../repositories/asset/events';
import type { AssetRecord } from './types';
import { usePlatformSnapshot } from '../platform/runtime';

function fontFamilyName(asset: AssetRecord): string {
  const base = (asset.fontFamily ?? asset.name ?? 'Custom Font').replace(/\.[^.]+$/, '').trim() || 'Custom Font';
  return `SMX_${base.replace(/[^a-zA-Z0-9]+/g, '_')}_${asset.id.slice(0, 6)}`;
}

function buildFontFaceCss(asset: AssetRecord): string {
  const family = fontFamilyName(asset);
  const src = asset.publicUrl ?? asset.src;
  return `@font-face{font-family:"${family}";src:url("${src}");font-display:swap;}`;
}

export function resolveFontAssetFamily(asset: AssetRecord): string {
  return fontFamilyName(asset);
}

export function FontAssetRuntime(): JSX.Element | null {
  const platform = usePlatformSnapshot();

  useEffect(() => {
    if (!platform.session.isAuthenticated || !platform.session.sessionId) {
      const existing = document.getElementById('smx-runtime-font-assets');
      if (existing) existing.textContent = '';
      return;
    }
    let cancelled = false;
    const styleId = 'smx-runtime-font-assets';

    const syncFonts = () => {
      void listAssets()
        .then((assets) => {
          if (cancelled) return;
          const fontAssets = assets.filter((asset) => asset.kind === 'font');
          let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = fontAssets.map(buildFontFaceCss).join('\n');
        })
        .catch(() => {
          if (cancelled) return;
          const existing = document.getElementById(styleId);
          if (existing) existing.textContent = '';
        });
    };

    syncFonts();
    const unsubscribe = subscribeToAssetLibraryChanges(syncFonts);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [platform.session.isAuthenticated, platform.session.sessionId]);

  return null;
}
