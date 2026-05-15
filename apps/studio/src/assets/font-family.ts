import type { AssetRecord } from './types';

function fontFormatFromSrc(src: string): string | null {
  const normalized = src.toLowerCase();
  if (normalized.includes('.woff2')) return 'woff2';
  if (normalized.includes('.woff')) return 'woff';
  if (normalized.includes('.ttf')) return 'truetype';
  if (normalized.includes('.otf')) return 'opentype';
  return null;
}

function fontFamilyName(asset: AssetRecord): string {
  const base = (asset.fontFamily ?? asset.name ?? 'Custom Font').replace(/\.[^.]+$/, '').trim() || 'Custom Font';
  const safeId = asset.id.replace(/[^a-zA-Z0-9]+/g, '');
  const suffix = safeId.slice(-8) || safeId || 'font';
  return `SMX_${base.replace(/[^a-zA-Z0-9]+/g, '_')}_${suffix}`;
}

function legacyFontFamilyNames(asset: AssetRecord): string[] {
  const base = (asset.fontFamily ?? asset.name ?? 'Custom Font').replace(/\.[^.]+$/, '').trim() || 'Custom Font';
  const safeBase = base.replace(/[^a-zA-Z0-9]+/g, '_');
  const safeId = asset.id.replace(/[^a-zA-Z0-9]+/g, '');
  const aliases = new Set<string>();
  const legacyPrefix = safeId.slice(0, 6);

  if (legacyPrefix) aliases.add(`SMX_${safeBase}_${legacyPrefix}`);
  aliases.add(`SMX_${safeBase}_asset-`);
  aliases.add(`SMX_${safeBase}`);

  return [...aliases];
}

export function resolveFontAssetFamily(asset: AssetRecord): string {
  return fontFamilyName(asset);
}

export function resolveFontAssetFamilyAliases(asset: AssetRecord): string[] {
  return [fontFamilyName(asset), ...legacyFontFamilyNames(asset)];
}

export function buildFontAssetCss(asset: AssetRecord): string {
  const src = asset.publicUrl ?? asset.src;
  const format = fontFormatFromSrc(src);
  return resolveFontAssetFamilyAliases(asset)
    .map((family) => `@font-face{font-family:"${family}";src:url("${src}")${format ? ` format("${format}")` : ''};font-display:swap;font-style:normal;font-weight:400;}`)
    .join('');
}
