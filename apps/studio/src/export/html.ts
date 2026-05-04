import { getActiveFeedRecord } from '../domain/document/resolvers';
import type { StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import type { GamHtml5AdapterResult, GenericHtml5AdapterResult, GoogleDisplayAdapterResult, MraidAdapterResult, PlayableExportAdapterResult, VastSimidAdapterResult } from './adapters';
import { buildExportAssetPathMap, buildExportAssetPlan } from './assets';
import { buildExportManifest } from './manifest';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportExitConfig } from './packaging';
import { buildExportRuntimeScript } from './runtime-script';
import { buildPortableProjectExport, type PortableExportScene, type PortableExportWidget } from './portable';

const LEAFLET_CSS_URL = import.meta.env.VITE_LEAFLET_CSS_URL || 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS_URL = import.meta.env.VITE_LEAFLET_JS_URL || 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
const CARTO_TILE_URL = import.meta.env.VITE_CARTO_TILE_URL || 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const BANNER_BASE_CSS = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: Inter, Arial, sans-serif; background: transparent; color: #e5e7eb; }
  .banner-shell { position: relative; overflow: hidden; }
  html[data-mraid-ready="true"] .banner-shell[data-adapter="mraid"] { width: 100%; height: 100%; }
  .banner-stage { width: 100%; height: 100%; position: relative; overflow: hidden; }
  .scene { display: none; }
  button.widget-cta:hover { filter: brightness(1.05); }
`.trim();

export function escapeHtml(value: unknown): string {
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
    html, body, #map { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #dbeafe; }
    .leaflet-container { font-family: Inter, Arial, sans-serif; background: #dbeafe; }
    .smx-export-map-label.leaflet-tooltip {
      background: #111827;
      border: none;
      border-radius: 999px;
      color: #fff;
      padding: 4px 8px;
      font-size: 10px;
      font-weight: 700;
      box-shadow: none;
    }
    .smx-export-map-label.leaflet-tooltip:before { display: none; }
    .smx-export-map-popup { font-family: Inter, Arial, sans-serif; min-width: 150px; }
    .smx-export-map-popup__title { font-size: 12px; font-weight: 800; color: #0f172a; line-height: 1.2; }
    .smx-export-map-popup__meta { margin-top: 4px; font-size: 10px; color: #475569; line-height: 1.25; }
    .smx-export-map-popup__badge {
      display: inline-flex;
      align-items: center;
      padding: 2px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      color: #fff;
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
      color: #fff;
      text-decoration: none;
      font-size: 10px;
      font-weight: 800;
    }
    .smx-export-map-popup__actions a[data-kind="waze"] { background: #08d4ff; }
    .smx-export-map-popup__actions a[data-kind="maps"] { background: #4285f4; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="${LEAFLET_JS_URL}"></script>
  <script>
    const places = ${placesJson};
    const map = L.map('map', { zoomControl: true, attributionControl: false, scrollWheelZoom: true }).setView([${input.latitude}, ${input.longitude}], ${input.zoom});
    L.tileLayer('${CARTO_TILE_URL}', { maxZoom: 19 }).addTo(map);
    let userMarker = null;
    function popupHtml(place) {
      const address = place.address ? '<div class="smx-export-map-popup__meta">' + String(place.address) + '</div>' : '';
      const badge = place.badge ? '<div class="smx-export-map-popup__badge">' + String(place.badge) + '</div>' : '';
      const actions = (place.wazeUrl || place.mapsUrl)
        ? '<div class="smx-export-map-popup__actions">'
          + (place.wazeUrl ? '<a href="' + String(place.wazeUrl) + '" target="_blank" rel="noopener noreferrer" data-kind="waze">Waze</a>' : '')
          + (place.mapsUrl ? '<a href="' + String(place.mapsUrl) + '" target="_blank" rel="noopener noreferrer" data-kind="maps">Maps</a>' : '')
          + '</div>'
        : '';
      return '<div class="smx-export-map-popup"><div class="smx-export-map-popup__title">' + String(place.name || '') + '</div>' + address + badge + actions + '</div>';
    }
    places.forEach((place) => {
      const marker = L.circleMarker([place.lat, place.lng], {
        radius: 7,
        color: '${input.accent}',
        weight: 3,
        fillColor: '#111827',
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
        color: '#111827',
        weight: 3,
        fillColor: '#ffffff',
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

function widgetHtml(node: PortableExportWidget, state: StudioState, assetPathMap: Record<string, string>): string {
  const definition = getWidgetDefinition(node.type);
  if (definition.renderExport) {
    return definition.renderExport(node as unknown as WidgetNode, state, assetPathMap);
  }
  const frame = node.frame;
  const style = node.style ?? {};
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `display:flex`,
    `align-items:center`,
    `justify-content:center`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? 'transparent')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `font-size:${Number(style.fontSize ?? 18)}px`,
    `font-weight:${Number(style.fontWeight ?? 700)}`,
    `border:1px solid ${String(style.borderColor ?? 'rgba(255,255,255,0.14)')}`,
    `padding:8px`,
    `text-align:center`,
  ].join(';');
  return `<div class="widget widget-module" data-widget-id="${node.id}" style="${base};flex-direction:column;gap:6px;"><strong>${String(node.name)}</strong><span style="font-size:12px;opacity:.8;">${String(node.type)}</span></div>`;
}

function sceneHtml(
  scene: PortableExportScene,
  canvas: { width: number; height: number; backgroundColor: string },
  state: StudioState,
  assetPathMap: Record<string, string>,
  visibleByDefault = false,
): string {
  const widgets = scene.widgets
    .filter((widget) => !widget.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);
  return `
    <section class="scene" data-scene-id="${scene.id}" data-scene-order="${scene.order}" style="position:absolute;inset:0;width:${canvas.width}px;height:${canvas.height}px;background:${escapeHtml(canvas.backgroundColor)};overflow:hidden;display:${visibleByDefault ? 'block' : 'none'};">
      ${widgets.map((widget) => widgetHtml(widget, state, assetPathMap)).join('\n')}
    </section>
  `;
}

export function buildStandaloneHtml(state: StudioState): string {
  const manifest = buildExportManifest(state);
  const activeRecord = getActiveFeedRecord(state);
  const portableProject = buildPortableProjectExport(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(portableProject));
  const orderedScenes = [...portableProject.scenes].sort((a, b) => a.order - b.order);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.document.name || 'SMX Export')}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: #0b1120; color: #e5e7eb; }
    .shell { min-height: 100vh; display: grid; place-items: center; padding: 32px; gap: 18px; }
    .meta { width: min(100%, 980px); display:flex; flex-wrap:wrap; gap:10px; }
    .pill { padding: 8px 12px; border-radius: 999px; background: rgba(255,255,255,.06); border: 1px solid rgba(255,255,255,.08); font-size: 12px; }
    .deck { display:grid; gap: 24px; }
    .scene-card { display:grid; gap:10px; }
    .scene-title { font-weight:800; font-size:14px; letter-spacing:.04em; text-transform:uppercase; opacity:.8; }
    button.widget-cta:hover { filter: brightness(1.05); }
    [data-map-cards]::-webkit-scrollbar, [data-map-search-scroll]::-webkit-scrollbar { width: 10px; }
    [data-map-cards]::-webkit-scrollbar-track, [data-map-search-scroll]::-webkit-scrollbar-track { background: var(--map-scrollbar-track, rgba(255,255,255,.18)); border-radius: 999px; }
    [data-map-cards]::-webkit-scrollbar-thumb, [data-map-search-scroll]::-webkit-scrollbar-thumb { background: var(--map-scrollbar-thumb, rgba(255,255,255,.92)); border-radius: 999px; border: 2px solid rgba(0,0,0,0); }
  </style>
</head>
<body>
  <div class="shell">
    <div class="meta">
      <div class="pill">${escapeHtml(state.document.name)}</div>
      <div class="pill">Variant ${escapeHtml(state.ui.activeVariant)}</div>
      <div class="pill">Feed ${escapeHtml(state.ui.activeFeedSource)} / ${escapeHtml(activeRecord?.label ?? state.ui.activeFeedRecordId)}</div>
      <div class="pill">Scenes ${orderedScenes.length}</div>
      <div class="pill">Widgets ${Object.keys(state.document.widgets).length}</div>
    </div>
    <div class="deck">
      ${orderedScenes.map((scene, index) => `<div class="scene-card"><div class="scene-title">${escapeHtml(scene.name)}</div>${sceneHtml(scene, portableProject.canvas, state, assetPathMap, index === 0)}</div>`).join('\n')}
    </div>
  </div>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
</body>
</html>`;
}

export type ExportHtmlAdapter =
  | GenericHtml5AdapterResult
  | GoogleDisplayAdapterResult
  | GamHtml5AdapterResult
  | MraidAdapterResult
  | PlayableExportAdapterResult
  | VastSimidAdapterResult;

function getPrimaryClickthroughUrl(adapter: ExportHtmlAdapter): string {
  if (adapter.adapter === 'playable-ad') {
    return adapter.bootstrap.clickthroughs[0]?.url ?? '';
  }
  return adapter.portableProject.interactions.find((interaction) => interaction.type === 'open-url')?.url ?? '';
}

function buildExitBootstrap(adapter: ExportHtmlAdapter): string {
  const fallbackUrl = JSON.stringify(getPrimaryClickthroughUrl(adapter));
  switch (adapter.adapter) {
    case 'gam-html5':
      return `
    window.ClickTag = window.ClickTag || window.clickTag || ${fallbackUrl};
    window.clickTag = window.ClickTag;
    window.smxExit = function smxExit(url) {
      var target = url || window.ClickTag || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'google-display':
      return `
    window.ClickTag = window.ClickTag || window.clickTag || ${fallbackUrl};
    window.clickTag = window.ClickTag;
    window.smxExit = function smxExit(url) {
      var target = url || window.ClickTag || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'generic-html5':
    case 'vast-simid':
      return `
    window.smxExit = function smxExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'mraid':
      return `
    window.smxMraidState = {
      ready: false,
      state: 'loading',
      placementType: 'inline',
      version: null,
      viewable: false,
      maxSize: null,
      screenSize: null,
      currentPosition: null,
      defaultPosition: null,
      supports: {},
      lastError: null
    };
    window.smxExit = function smxExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (window.mraid && typeof window.mraid.open === 'function') {
        window.mraid.open(target);
        return;
      }
      if (typeof window.open === 'function') window.open(target, '_blank');
    };
    (function initMraidBridge() {
      if (!window.mraid) return;
      function syncMraidAttributes() {
        var state = window.smxMraidState || {};
        document.documentElement.setAttribute('data-mraid-ready', String(Boolean(state.ready)));
        document.documentElement.setAttribute('data-mraid-state', String(state.state || 'unknown'));
        document.documentElement.setAttribute('data-mraid-placement', String(state.placementType || 'inline'));
        document.documentElement.setAttribute('data-mraid-viewable', String(Boolean(state.viewable)));
        if (state.maxSize && Number.isFinite(state.maxSize.width) && Number.isFinite(state.maxSize.height)) {
          document.documentElement.setAttribute('data-mraid-max-size', String(state.maxSize.width) + 'x' + String(state.maxSize.height));
        }
        if (typeof window.CustomEvent === 'function') {
          window.dispatchEvent(new CustomEvent('smx:mraid-change', { detail: state }));
        }
      }
      function refreshMetrics() {
        try {
          window.smxMraidState.version = typeof window.mraid.getVersion === 'function' ? window.mraid.getVersion() : '2.0';
          window.smxMraidState.placementType = typeof window.mraid.getPlacementType === 'function' ? window.mraid.getPlacementType() : 'inline';
          window.smxMraidState.viewable = typeof window.mraid.isViewable === 'function' ? Boolean(window.mraid.isViewable()) : Boolean(window.smxMraidState.viewable);
          window.smxMraidState.maxSize = typeof window.mraid.getMaxSize === 'function' ? window.mraid.getMaxSize() : null;
          window.smxMraidState.screenSize = typeof window.mraid.getScreenSize === 'function' ? window.mraid.getScreenSize() : null;
          window.smxMraidState.currentPosition = typeof window.mraid.getCurrentPosition === 'function' ? window.mraid.getCurrentPosition() : null;
          window.smxMraidState.defaultPosition = typeof window.mraid.getDefaultPosition === 'function' ? window.mraid.getDefaultPosition() : null;
          window.smxMraidState.supports = {
            sms: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('sms')) : false,
            tel: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('tel')) : false,
            calendar: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('calendar')) : false,
            storePicture: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('storePicture')) : false,
            inlineVideo: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('inlineVideo')) : false,
            location: typeof window.mraid.supports === 'function' ? Boolean(window.mraid.supports('location')) : false,
          };
          if (window.smxMraidState.version && window.smxMraidState.version < '3.0') {
            console.warn('[SMX MRAID] Host reports MRAID v' + window.smxMraidState.version + '. Some features require 3.0.');
          }
        } catch (_error) {
          window.smxMraidState.lastError = 'metrics';
        }
      }
      function markReady() {
        window.smxMraidState.ready = true;
        try {
          window.smxMraidState.state = typeof window.mraid.getState === 'function' ? window.mraid.getState() : 'default';
        } catch (_error) {
          window.smxMraidState.state = 'default';
        }
        refreshMetrics();
        syncMraidAttributes();
      }
      function handleStateChange(nextState) {
        window.smxMraidState.state = nextState || 'unknown';
        refreshMetrics();
        syncMraidAttributes();
      }
      function handleViewableChange(nextViewable) {
        window.smxMraidState.viewable = Boolean(nextViewable);
        syncMraidAttributes();
      }
      function handleSizeChange() {
        refreshMetrics();
        syncMraidAttributes();
      }
      function handleError(message, action) {
        window.smxMraidState.lastError = { message: message || null, action: action || null };
        syncMraidAttributes();
      }
      try {
        if (typeof window.mraid.getState === 'function' && window.mraid.getState() === 'loading') {
          window.mraid.addEventListener('ready', markReady);
          if (typeof window.mraid.useCustomClose === 'function') {
            window.mraid.useCustomClose(true);
          }
        } else {
          markReady();
          if (typeof window.mraid.useCustomClose === 'function') {
            window.mraid.useCustomClose(true);
          }
        }
        if (typeof window.mraid.addEventListener === 'function') {
          window.mraid.addEventListener('stateChange', handleStateChange);
          window.mraid.addEventListener('viewableChange', handleViewableChange);
          window.mraid.addEventListener('sizeChange', handleSizeChange);
          window.mraid.addEventListener('error', handleError);
        }
      } catch (_error) {
        markReady();
      }
    })();`;
    case 'playable-ad':
      return `
    window.smxPlayableExit = function smxPlayableExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.mraid !== 'undefined' && typeof window.mraid.open === 'function') {
        window.mraid.open(target);
        return;
      }
      if (typeof FbPlayableAd !== 'undefined' && typeof FbPlayableAd.onCTAClick === 'function') {
        FbPlayableAd.onCTAClick();
        return;
      }
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    default:
      return '';
  }
}

export function buildPlayableSingleFileHtml(
  state: StudioState,
  adapter: PlayableExportAdapterResult,
  inlinedAssetMap: Record<string, string> = {},
): string {
  const exitConfig = buildExportExitConfig(adapter);
  const runtimeModel = buildExportRuntimeModelFromPortable(adapter.playableProject);
  const assetPlan = buildExportAssetPlan(adapter.playableProject);
  const resolvedAssetPathMap = Object.fromEntries(
    assetPlan.map((entry) => [entry.sourceUrl, inlinedAssetMap[entry.sourceUrl] ?? entry.sourceUrl]),
  );
  const canvas = adapter.playableProject.canvas;
  const documentName = adapter.playableProject.name || state.document.name || 'SMX Playable';
  const orderedScenes = [...adapter.playableProject.scenes].sort((left, right) => left.order - right.order);
  const runtimeScript = buildExportRuntimeScript(adapter);
  const exitBootstrap = buildExitBootstrap(adapter);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escapeHtml(documentName)}</title>
  <style>
    ${BANNER_BASE_CSS}
    html, body { width: 100%; height: 100%; overflow: hidden; touch-action: none; }
    .banner-shell { width: 100%; height: 100%; background: ${escapeHtml(canvas.backgroundColor)}; }
    .banner-stage { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div class="banner-shell" data-adapter="playable-ad" data-document-name="${escapeHtml(documentName)}">
    <div class="banner-stage">
      ${orderedScenes.map((scene, index) => sceneHtml(scene, canvas, state, resolvedAssetPathMap, index === 0)).join('\n')}
    </div>
  </div>
  <script>
  (function() {${exitBootstrap}
  })();
  </script>
  <script type="application/json" id="smx-runtime-model">${escapeHtml(JSON.stringify(runtimeModel))}</script>
  <script type="application/json" id="smx-exit-config">${escapeHtml(JSON.stringify(exitConfig))}</script>
  <script>${runtimeScript}</script>
</body>
</html>`;
}

export function buildChannelHtml(state: StudioState, adapter: ExportHtmlAdapter): string {
  if (adapter.adapter === 'playable-ad') {
    return buildPlayableSingleFileHtml(state, adapter);
  }
  const nonPlayableAdapter = adapter as Exclude<ExportHtmlAdapter, PlayableExportAdapterResult>;
  const manifest = buildExportManifest(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(nonPlayableAdapter.portableProject);
  const exitConfig = buildExportExitConfig(adapter);
  const activeRecord = getActiveFeedRecord(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(nonPlayableAdapter.portableProject));
  const orderedScenes = [...nonPlayableAdapter.portableProject.scenes].sort((a, b) => a.order - b.order);
  const exitBootstrap = buildExitBootstrap(adapter);
  const canvas = nonPlayableAdapter.portableProject.canvas;
  const documentName = nonPlayableAdapter.portableProject.name || state.document.name || 'SMX Export';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentName)}</title>
  <style>
    ${BANNER_BASE_CSS}
    .banner-shell { width: ${canvas.width}px; height: ${canvas.height}px; background: ${escapeHtml(canvas.backgroundColor)}; }
  </style>
</head>
<body>
  <div class="banner-shell" data-document-name="${escapeHtml(documentName)}" data-active-variant="${escapeHtml(nonPlayableAdapter.portableProject.activeVariant)}" data-active-feed="${escapeHtml(nonPlayableAdapter.portableProject.activeFeedSource)}" data-active-record="${escapeHtml(activeRecord?.label ?? nonPlayableAdapter.portableProject.activeFeedRecordId)}" data-adapter="${escapeHtml(adapter.adapter)}">
    <div class="banner-stage">
      ${orderedScenes.map((scene, index) => sceneHtml(scene, canvas, state, assetPathMap, index === 0)).join('\n')}
    </div>
  </div>
  <script>
  (function() {${exitBootstrap}
  })();
  </script>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
  <script type="application/json" id="smx-runtime-model">${escapeHtml(JSON.stringify(runtimeModel, null, 2))}</script>
  <script type="application/json" id="smx-exit-config">${escapeHtml(JSON.stringify(exitConfig, null, 2))}</script>
  <script src="./runtime.js"></script>
</body>
</html>`;
}
