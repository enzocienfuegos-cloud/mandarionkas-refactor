import type { AssetRecord } from './types';

function fontFamilyName(asset: AssetRecord): string {
  const base = (asset.fontFamily ?? asset.name ?? 'Custom Font').replace(/\.[^.]+$/, '').trim() || 'Custom Font';
  return `SMX_${base.replace(/[^a-zA-Z0-9]+/g, '_')}_${asset.id.slice(0, 6)}`;
}

export function resolveFontAssetFamily(asset: AssetRecord): string {
  return fontFamilyName(asset);
}

export function buildFontAssetCss(asset: AssetRecord): string {
  const family = fontFamilyName(asset);
  const src = asset.publicUrl ?? asset.src;
  return `@font-face{font-family:"${family}";src:url("${src}");font-display:swap;}`;
}
