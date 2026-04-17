import { useEffect } from 'react';
import { buildFontAssetCss } from '../assets/font-family';
import type { AssetRecord } from '../assets/types';
import { listAssets } from '../repositories/asset';
import { subscribeToAssetLibraryChanges } from '../repositories/asset/events';
import { usePlatformSnapshot } from '../platform/runtime';

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
          const fontAssets = assets.filter((asset: AssetRecord) => asset.kind === 'font');
          let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
          if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
          }
          styleEl.textContent = fontAssets.map(buildFontAssetCss).join('\n');
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
