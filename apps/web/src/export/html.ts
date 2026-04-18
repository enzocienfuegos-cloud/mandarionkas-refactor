import { getActiveFeedRecord, resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { SceneNode, StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import { getExportChannelProfile } from './adapters';
import { buildExportManifest } from './manifest';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function widgetHtml(node: WidgetNode, state: StudioState): string {
  const definition = getWidgetDefinition(node.type);
  if (definition.renderExport) {
    return definition.renderExport(node, state);
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

function sceneHtml(scene: SceneNode, state: StudioState): string {
  const widgets = scene.widgetIds
    .map((id) => state.document.widgets[id])
    .filter(Boolean)
    .map((widget) => resolveWidgetSnapshot(widget, state))
    .filter((widget) => !widget.hidden)
    .sort((a, b) => a.zIndex - b.zIndex);

  return `
    <section class="scene" data-scene-id="${scene.id}" style="position:relative;width:${state.document.canvas.width}px;height:${state.document.canvas.height}px;background:${escapeHtml(state.document.canvas.backgroundColor)};overflow:hidden;border-radius:20px;border:1px solid rgba(255,255,255,.08);box-shadow:0 18px 45px rgba(0,0,0,.22);">
      ${widgets.map((widget) => widgetHtml(widget, state)).join('\n')}
    </section>
  `;
}

function buildMraidBridgeScript(channelProfile: ReturnType<typeof getExportChannelProfile>): string {
  return `
    (function () {
      var profile = ${JSON.stringify({
        id: channelProfile.id,
        label: channelProfile.label,
        family: channelProfile.family,
        deliveryMode: channelProfile.deliveryMode,
        exitStrategy: channelProfile.exitStrategy,
      })};
      var root = document.documentElement;
      var state = {
        channel: profile.id,
        ready: false,
        state: 'loading',
        viewable: undefined,
        placementType: undefined,
        version: undefined,
        maxSize: undefined,
        screenSize: undefined,
        currentPosition: undefined,
        defaultPosition: undefined,
        supports: {},
        lastError: undefined,
      };

      function syncDom() {
        root.setAttribute('data-export-channel', String(profile.id || 'generic-html5'));
        root.setAttribute('data-export-delivery', String(profile.deliveryMode || 'html5'));
        root.setAttribute('data-export-exit', String(profile.exitStrategy || 'window-open'));
        root.setAttribute('data-mraid-ready', state.ready ? 'true' : 'false');
        root.setAttribute('data-mraid-state', String(state.state || 'unknown'));
        root.setAttribute('data-mraid-placement', String(state.placementType || ''));
        root.setAttribute('data-mraid-viewable', typeof state.viewable === 'boolean' ? String(state.viewable) : '');
        if (state.maxSize && typeof state.maxSize.width === 'number' && typeof state.maxSize.height === 'number') {
          root.setAttribute('data-mraid-max-size', state.maxSize.width + 'x' + state.maxSize.height);
        } else {
          root.removeAttribute('data-mraid-max-size');
        }
      }

      function emitChange() {
        syncDom();
        window.smxMraidState = state;
        window.dispatchEvent(new CustomEvent('smx:mraid-change', { detail: state }));
      }

      function normalizeLocation(raw, source) {
        if (!raw || typeof raw !== 'object') return null;
        var lat = typeof raw.lat === 'number' ? raw.lat : (typeof raw.latitude === 'number' ? raw.latitude : undefined);
        var lng = typeof raw.lon === 'number' ? raw.lon : (typeof raw.lng === 'number' ? raw.lng : (typeof raw.longitude === 'number' ? raw.longitude : undefined));
        if (typeof lat !== 'number' || typeof lng !== 'number') return null;
        return {
          source: source,
          lat: lat,
          lng: lng,
          accuracy: typeof raw.accuracy === 'number' ? raw.accuracy : undefined,
          timestamp: typeof raw.lastfix === 'number' ? Date.now() - (raw.lastfix * 1000) : Date.now(),
          raw: raw,
        };
      }

      function captureHostMetrics(mraid) {
        try { state.version = typeof mraid.getVersion === 'function' ? mraid.getVersion() : state.version; } catch {}
        try { state.state = typeof mraid.getState === 'function' ? mraid.getState() : state.state; } catch {}
        try { state.viewable = typeof mraid.isViewable === 'function' ? mraid.isViewable() : state.viewable; } catch {}
        try { state.placementType = typeof mraid.getPlacementType === 'function' ? mraid.getPlacementType() : state.placementType; } catch {}
        try { state.maxSize = typeof mraid.getMaxSize === 'function' ? mraid.getMaxSize() : state.maxSize; } catch {}
        try { state.screenSize = typeof mraid.getScreenSize === 'function' ? mraid.getScreenSize() : state.screenSize; } catch {}
        try { state.currentPosition = typeof mraid.getCurrentPosition === 'function' ? mraid.getCurrentPosition() : state.currentPosition; } catch {}
        try { state.defaultPosition = typeof mraid.getDefaultPosition === 'function' ? mraid.getDefaultPosition() : state.defaultPosition; } catch {}
        try {
          state.supports = {
            sms: typeof mraid.supports === 'function' ? !!mraid.supports('sms') : false,
            tel: typeof mraid.supports === 'function' ? !!mraid.supports('tel') : false,
            calendar: typeof mraid.supports === 'function' ? !!mraid.supports('calendar') : false,
            storePicture: typeof mraid.supports === 'function' ? !!mraid.supports('storePicture') : false,
            inlineVideo: typeof mraid.supports === 'function' ? !!mraid.supports('inlineVideo') : false,
            location: typeof mraid.supports === 'function' ? !!mraid.supports('location') : false,
          };
        } catch {}
      }

      function attachMraidBridge(mraid) {
        if (!mraid || typeof mraid.addEventListener !== 'function') return;

        function markReady() {
          state.ready = true;
          captureHostMetrics(mraid);
          emitChange();
        }

        try {
          mraid.addEventListener('ready', markReady);
          mraid.addEventListener('stateChange', function (nextState) {
            state.state = nextState;
            captureHostMetrics(mraid);
            emitChange();
          });
          mraid.addEventListener('viewableChange', function (viewable) {
            state.viewable = !!viewable;
            emitChange();
          });
          mraid.addEventListener('sizeChange', function (width, height) {
            state.maxSize = { width: width, height: height };
            emitChange();
          });
          mraid.addEventListener('error', function (message, action) {
            state.lastError = { message: message, action: action };
            emitChange();
          });
        } catch {}

        try {
          if (typeof mraid.getState === 'function' && mraid.getState() === 'loading') {
            captureHostMetrics(mraid);
            emitChange();
          } else {
            markReady();
          }
        } catch {
          markReady();
        }
      }

      window.smxOpenUrl = function (url) {
        if (!url) return;
        try {
          if (window.mraid && typeof window.mraid.open === 'function') {
            window.mraid.open(url);
            return;
          }
        } catch {}
        window.open(url, '_blank', 'noopener,noreferrer');
      };

      window.smxGetRuntimeLocation = async function () {
        try {
          if (window.mraid && typeof window.mraid.supports === 'function' && window.mraid.supports('location') && typeof window.mraid.getLocation === 'function') {
            var mraidLocation = normalizeLocation(window.mraid.getLocation(), 'mraid');
            if (mraidLocation) return mraidLocation;
          }
        } catch {}

        try {
          if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
            return await new Promise(function (resolve) {
              navigator.geolocation.getCurrentPosition(function (position) {
                resolve({
                  source: 'browser',
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: position.timestamp,
                  raw: position,
                });
              }, function () {
                resolve({ source: 'none' });
              }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
            });
          }
        } catch {}

        return { source: 'none' };
      };

      syncDom();
      attachMraidBridge(window.mraid);
    })();
  `;
}

function buildGenericHostBridgeScript(channelProfile: ReturnType<typeof getExportChannelProfile>): string {
  return `
    (function () {
      var profile = ${JSON.stringify({
        id: channelProfile.id,
        label: channelProfile.label,
        family: channelProfile.family,
        deliveryMode: channelProfile.deliveryMode,
        exitStrategy: channelProfile.exitStrategy,
      })};
      var root = document.documentElement;
      root.setAttribute('data-export-channel', String(profile.id || 'generic-html5'));
      root.setAttribute('data-export-delivery', String(profile.deliveryMode || 'html5'));
      root.setAttribute('data-export-exit', String(profile.exitStrategy || 'window-open'));
      window.smxOpenUrl = function (url) {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
      };
      window.smxGetRuntimeLocation = async function () {
        try {
          if (navigator.geolocation && typeof navigator.geolocation.getCurrentPosition === 'function') {
            return await new Promise(function (resolve) {
              navigator.geolocation.getCurrentPosition(function (position) {
                resolve({
                  source: 'browser',
                  lat: position.coords.latitude,
                  lng: position.coords.longitude,
                  accuracy: position.coords.accuracy,
                  timestamp: position.timestamp,
                  raw: position,
                });
              }, function () {
                resolve({ source: 'none' });
              }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 300000 });
            });
          }
        } catch {}
        return { source: 'none' };
      };
    })();
  `;
}

export function buildStandaloneHtml(state: StudioState): string {
  const manifest = buildExportManifest(state);
  const channelProfile = getExportChannelProfile(state.document.metadata.release.targetChannel);
  const hostBridgeScript = channelProfile.id === 'mraid'
    ? buildMraidBridgeScript(channelProfile)
    : buildGenericHostBridgeScript(channelProfile);
  const activeRecord = getActiveFeedRecord(state);
  const orderedScenes = [...state.document.scenes].sort((a, b) => a.order - b.order);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.document.name || 'SMX Export')}</title>
  ${channelProfile.id === 'mraid' ? '<script>window.MRAID_ENV = window.MRAID_ENV || {};</script>' : ''}
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
      ${orderedScenes.map((scene) => `<div class="scene-card"><div class="scene-title">${escapeHtml(scene.name)}</div>${sceneHtml(scene, state)}</div>`).join('\n')}
    </div>
  </div>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
  <script>${hostBridgeScript}</script>
</body>
</html>`;
}
