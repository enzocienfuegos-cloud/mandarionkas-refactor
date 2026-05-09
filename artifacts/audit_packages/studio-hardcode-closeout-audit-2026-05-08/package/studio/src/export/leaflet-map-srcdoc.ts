import { DYNAMIC_MAP_ACTION_LABELS, DYNAMIC_MAP_TILE_URL } from '../widgets/modules/dynamic-map.shared';

const LEAFLET_CSS_URL = import.meta.env.VITE_LEAFLET_CSS_URL || 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = import.meta.env.VITE_LEAFLET_JS_URL || 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

const leafletMapPalette = {
  white: '#ffffff',
  ink: '#111827',
  slate: '#0f172a',
  softBlue: '#dbeafe',
  softText: '#475569',
  mapsBlue: '#4285f4',
  wazeBlue: '#08d4ff',
} as const;

function escapeLeafletHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function buildExportLeafletMapSrcdoc(input: {
  places: Array<{ name: string; lat: number; lng: number; address?: string; badge?: string; mapsUrl?: string; wazeUrl?: string }>;
  latitude: number;
  longitude: number;
  zoom: number;
  accent: string;
  routeVisible: boolean;
}): string {
  const places = input.places.filter((place) => Number.isFinite(place.lat) && Number.isFinite(place.lng)).slice(0, 25);
  const placesJson = JSON.stringify(places);
  const routeScript = input.routeVisible
    ? `
      if (places.length > 1) {
        const latlngs = places.map((place) => [place.lat, place.lng]);
        L.polyline(latlngs, { color: '${input.accent}', weight: 3, dashArray: '7 6', opacity: 0.9 }).addTo(map);
      }
    `
    : '';

  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${LEAFLET_CSS_URL}" />
  <style>
    html, body, #map { margin: 0; width: 100%; height: 100%; overflow: hidden; background: ${leafletMapPalette.softBlue}; }
    .leaflet-container { font-family: Inter, Arial, sans-serif; background: ${leafletMapPalette.softBlue}; }
    .smx-export-map-label.leaflet-tooltip {
      background: ${leafletMapPalette.ink};
      border: none;
      border-radius: 999px;
      color: ${leafletMapPalette.white};
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      box-shadow: none;
    }
    .smx-export-map-label.leaflet-tooltip:before { display: none; }
    .smx-export-map-popup { font-family: Inter, Arial, sans-serif; min-width: 150px; }
    .smx-export-map-popup__title { font-size: 12px; font-weight: 800; color: ${leafletMapPalette.slate}; line-height: 1.2; }
    .smx-export-map-popup__meta { margin-top: 4px; font-size: 10px; color: ${leafletMapPalette.softText}; line-height: 1.25; }
    .smx-export-map-popup__badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      color: ${leafletMapPalette.white};
      background: ${input.accent};
      margin-top: 6px;
    }
    .smx-export-map-popup__actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
    .smx-export-map-popup__actions a {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 44px;
      height: 24px;
      border-radius: 999px;
      padding: 0 10px;
      color: ${leafletMapPalette.white};
      text-decoration: none;
      font-size: 10px;
      font-weight: 800;
    }
    .smx-export-map-popup__actions a[data-kind="waze"] { background: ${leafletMapPalette.wazeBlue}; }
    .smx-export-map-popup__actions a[data-kind="maps"] { background: ${leafletMapPalette.mapsBlue}; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${LEAFLET_JS_URL}"></script>
  <script>
    const places = ${placesJson};
    const map = L.map('map', { zoomControl: true, attributionControl: false, scrollWheelZoom: true }).setView([${input.latitude}, ${input.longitude}], ${input.zoom});
    L.tileLayer('${DYNAMIC_MAP_TILE_URL}', { maxZoom: 19 }).addTo(map);
    let userMarker = null;
    function popupHtml(place) {
      const address = place.address ? '<div class="smx-export-map-popup__meta">' + String(place.address) + '</div>' : '';
      const badge = place.badge ? '<div class="smx-export-map-popup__badge">' + String(place.badge) + '</div>' : '';
      const actions = (place.wazeUrl || place.mapsUrl)
        ? '<div class="smx-export-map-popup__actions">'
          + (place.wazeUrl ? '<a href="' + String(place.wazeUrl) + '" target="_blank" rel="noopener noreferrer" data-kind="waze">${DYNAMIC_MAP_ACTION_LABELS.waze}</a>' : '')
          + (place.mapsUrl ? '<a href="' + String(place.mapsUrl) + '" target="_blank" rel="noopener noreferrer" data-kind="maps">${DYNAMIC_MAP_ACTION_LABELS.maps}</a>' : '')
          + '</div>'
        : '';
      return '<div class="smx-export-map-popup"><div class="smx-export-map-popup__title">' + String(place.name || '') + '</div>' + address + badge + actions + '</div>';
    }
    places.forEach((place) => {
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 7,
        color: '${escapeLeafletHtml(input.accent)}',
        weight: 3,
        fillColor: '${leafletMapPalette.ink}',
        fillOpacity: 1
      }).addTo(map);
      marker.bindPopup(popupHtml(place), { closeButton: true, autoPan: true, maxWidth: 220 });
      marker.bindTooltip(place.name, {
        permanent: true,
        direction: 'top',
        offset: [0, -10],
        className: 'smx-export-map-label'
      });
    });
    ${routeScript}
    if (places.length) {
      const bounds = L.latLngBounds(places.map((place) => [place.lat, place.lng]));
      if (bounds.isValid()) map.fitBounds(bounds.pad(0.25));
    }
    window.addEventListener('message', (event) => {
      const data = event && event.data ? event.data : null;
      if (!data || data.type !== 'smx-map-center-user') return;
      const latitude = Number(data.latitude);
      const longitude = Number(data.longitude);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return;
      if (userMarker) map.removeLayer(userMarker);
      userMarker = L.circleMarker([latitude, longitude], {
        radius: 7,
        color: '${leafletMapPalette.ink}',
        weight: 3,
        fillColor: '${leafletMapPalette.white}',
        fillOpacity: 1
      }).addTo(map);
      userMarker.bindPopup('<div class="smx-export-map-popup"><div class="smx-export-map-popup__title">' + String(data.label || 'Your location') + '</div></div>');
      map.setView([latitude, longitude], Math.max(map.getZoom(), ${input.zoom}));
      userMarker.openPopup();
    });
  </script>
</body>
</html>`.trim();
}
