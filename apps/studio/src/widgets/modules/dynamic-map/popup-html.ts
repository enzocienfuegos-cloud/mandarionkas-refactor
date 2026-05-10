import { buildPlaceCtaUrl, DYNAMIC_MAP_ACTION_LABELS, type NearbyPlace } from './places-loader';
import { dynamicMapBrandPalette, dynamicMapPalette } from './style-recipe';

export function buildDynamicMapPopupHtml(place: NearbyPlace, accent: string): string {
  const badge = place.badge
    ? `<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;color:${dynamicMapPalette.white};background:${accent};">${place.badge}</span>`
    : '';
  return `
    <div style="min-width:190px;color:${dynamicMapPalette.ink900};">
      <div style="font-size:14px;font-weight:900;line-height:1.2;">${place.name}</div>
      <div style="font-size:11px;color:${dynamicMapPalette.muted};margin-top:4px;line-height:1.3;">${place.address || ''}</div>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:8px;">${badge}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <a href="${buildPlaceCtaUrl(place, 'waze')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:${dynamicMapPalette.white};font-size:10px;font-weight:800;text-decoration:none;background:${dynamicMapBrandPalette.wazeBlue};">${DYNAMIC_MAP_ACTION_LABELS.waze}</a>
        <a href="${buildPlaceCtaUrl(place, 'maps')}" target="_blank" rel="noreferrer" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:${dynamicMapPalette.white};font-size:10px;font-weight:800;text-decoration:none;background:${dynamicMapBrandPalette.mapsBlue};">${DYNAMIC_MAP_ACTION_LABELS.maps}</a>
      </div>
    </div>
  `;
}
