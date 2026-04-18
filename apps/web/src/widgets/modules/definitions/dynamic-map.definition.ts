import type { WidgetNode } from '../../../domain/document/types';
import { createModuleDefinition } from '../module-definition-factory';
import { renderDynamicMapStage } from '../dynamic-map.renderer';
import { escapeHtml, getBaseWidgetStyle } from '../../registry/export-helpers';

type CsvMarker = { name: string; flag: string; lat: number; lng: number };

function parseCsvMarkers(csv: string): CsvMarker[] {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines.length <= 1) return [];
  const header = lines[0].split(',').map((item) => item.trim().toLowerCase());
  const nameIndex = header.indexOf('name');
  const flagIndex = header.indexOf('flag');
  const latIndex = header.findIndex((value) => value === 'lat' || value === 'latitude');
  const lngIndex = header.findIndex((value) => value === 'lng' || value === 'lon' || value === 'longitude');
  return lines.slice(1).map((line) => {
    const cols = line.split(',').map((item) => item.trim());
    return {
      name: cols[nameIndex] ?? 'Pin',
      flag: cols[flagIndex] ?? '',
      lat: Number(cols[latIndex]),
      lng: Number(cols[lngIndex]),
    };
  }).filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lng));
}

function buildMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat},${lng}`)}`;
}

function buildWazeUrl(lat: number, lng: number): string {
  return `https://waze.com/ul?ll=${encodeURIComponent(`${lat},${lng}`)}&navigate=yes`;
}

function renderDynamicMapExport(node: WidgetNode): string {
  const base = `${getBaseWidgetStyle(node)};display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:12px;align-items:stretch;padding:12px;background:${escapeHtml(String(node.style.backgroundColor ?? '#dbeafe'))};color:${escapeHtml(String(node.style.color ?? '#0f172a'))};`;
  const title = escapeHtml(String(node.props.title ?? node.name));
  const location = String(node.props.location ?? 'Main pin');
  const latitude = Number(node.props.latitude ?? 13.6929);
  const longitude = Number(node.props.longitude ?? -89.2182);
  const zoom = Number(node.props.zoom ?? 13);
  const accent = escapeHtml(String(node.style.accentColor ?? '#ef4444'));
  const markers = (parseCsvMarkers(String(node.props.markersCsv ?? '')) || []).slice(0, 4);
  const effectiveMarkers = markers.length ? markers : [{ name: location, flag: '', lat: latitude, lng: longitude }];

  return `
    <div class="widget widget-dynamic-map" data-widget-id="${node.id}" data-lat="${latitude}" data-lng="${longitude}" style="${base}">
      <div style="position:relative;border-radius:14px;overflow:hidden;min-height:0;background:linear-gradient(135deg,#dbeafe,#bfdbfe);padding:12px;display:flex;flex-direction:column;justify-content:space-between;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong style="font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:${accent};">${title}</strong>
          <button type="button" class="widget-map-locate" style="border:none;border-radius:999px;padding:8px 12px;background:#fff;color:#0f172a;font-size:12px;font-weight:800;cursor:pointer;">Locate me</button>
        </div>
        <div style="position:relative;flex:1;min-height:120px;border-radius:12px;background:linear-gradient(135deg,rgba(255,255,255,.55),rgba(255,255,255,.2));overflow:hidden;">
          <div class="widget-map-status" style="position:absolute;left:12px;bottom:12px;z-index:2;border-radius:999px;padding:6px 10px;background:rgba(15,23,42,.78);color:#fff;font-size:11px;">Waiting for location</div>
          ${effectiveMarkers.map((marker, index) => `
            <div style="position:absolute;left:${18 + index * 18}%;top:${26 + (index % 2) * 22}%;transform:translate(-50%,-100%);display:flex;flex-direction:column;align-items:center;gap:4px;">
              <div style="min-width:30px;padding:4px 6px;border-radius:999px;background:rgba(15,23,42,.82);color:#fff;font-size:10px;white-space:nowrap;">${escapeHtml(marker.name)}</div>
              <div style="width:18px;height:18px;border-radius:50%;background:${accent};border:2px solid rgba(255,255,255,.88);box-shadow:0 0 0 6px rgba(239,68,68,.14);"></div>
            </div>
          `).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:11px;opacity:.78;">
          <span>${effectiveMarkers.length} marker${effectiveMarkers.length === 1 ? '' : 's'} · zoom ${zoom}</span>
          <span class="widget-map-coords">${latitude.toFixed(3)}, ${longitude.toFixed(3)}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px;min-width:0;">
        ${effectiveMarkers.map((marker, index) => `
          <div style="border-radius:12px;padding:12px;background:rgba(255,255,255,.58);border:1px solid rgba(255,255,255,.45);display:grid;gap:8px;">
            <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
              <strong style="font-size:15px;line-height:1.2;">${escapeHtml(marker.name)}</strong>
              <span style="font-size:11px;border-radius:999px;padding:4px 8px;background:rgba(15,23,42,.08);">Pin ${index + 1}</span>
            </div>
            <div style="font-size:12px;opacity:.82;">${escapeHtml(`${marker.lat.toFixed(4)}, ${marker.lng.toFixed(4)}`)}</div>
            <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;">
              <a href="${escapeHtml(buildWazeUrl(marker.lat, marker.lng))}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:10px 12px;background:#22c7f5;color:#fff;font-weight:800;text-decoration:none;">Waze</a>
              <a href="${escapeHtml(buildMapsUrl(marker.lat, marker.lng))}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;justify-content:center;border-radius:12px;padding:10px 12px;background:#3b82f6;color:#fff;font-weight:800;text-decoration:none;">Maps</a>
            </div>
          </div>
        `).join('')}
      </div>
      <script>
        (function () {
          var root = document.currentScript && document.currentScript.parentElement;
          if (!root) return;
          var locateButton = root.querySelector('.widget-map-locate');
          var statusNode = root.querySelector('.widget-map-status');
          var coordsNode = root.querySelector('.widget-map-coords');
          if (!locateButton || typeof window.smxGetRuntimeLocation !== 'function') return;
          locateButton.addEventListener('click', async function () {
            locateButton.disabled = true;
            if (statusNode) statusNode.textContent = 'Locating…';
            try {
              var result = await window.smxGetRuntimeLocation();
              if (result && typeof result.lat === 'number' && typeof result.lng === 'number') {
                if (statusNode) statusNode.textContent = (result.source === 'mraid' ? 'Located via MRAID' : 'Located via browser');
                if (coordsNode) coordsNode.textContent = result.lat.toFixed(3) + ', ' + result.lng.toFixed(3);
                root.setAttribute('data-user-lat', String(result.lat));
                root.setAttribute('data-user-lng', String(result.lng));
              } else if (statusNode) {
                statusNode.textContent = 'Location unavailable';
              }
            } catch (_error) {
              if (statusNode) statusNode.textContent = 'Location unavailable';
            } finally {
              locateButton.disabled = false;
            }
          });
        })();
      </script>
    </div>
  `;
}

export const DynamicMapDefinition = createModuleDefinition({
  type: 'dynamic-map',
  label: 'Dynamic Map',
  category: 'interactive',
  frame: { x: 100, y: 70, width: 220, height: 118, rotation: 0 },
  props: { title: 'Dynamic Map', location: 'San Salvador', radiusKm: 5, pinLabel: 'Store', latitude: 13.6929, longitude: -89.2182, zoom: 13, markersCsv: 'name,flag,lat,lng\nSan Salvador,SV,13.6929,-89.2182\nSanta Tecla,SV,13.6769,-89.2797', provider: 'osm' },
  style: { backgroundColor: '#dbeafe', accentColor: '#ef4444', color: '#0f172a' },
  renderStage: renderDynamicMapStage,
  exportDetail: 'Dynamic map',
  renderExport: (node) => renderDynamicMapExport(node),
});
