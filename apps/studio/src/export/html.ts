import { getActiveFeedRecord } from '../domain/document/resolvers';
import type { StudioState } from '../domain/document/types';
import { buildResolvedWidgetsById } from '../domain/document/canvas-variants';
import { buildFontFaceCss } from '../assets/font-family';
import { renderWidgetExport } from '../widgets/modules/export-registry';
import type { GamHtml5AdapterResult, GenericHtml5AdapterResult, GoogleDisplayAdapterResult, MraidAdapterResult, PlayableExportAdapterResult, VastSimidAdapterResult } from './adapters';
import { buildExportAssetPathMap, buildExportAssetPlan } from './assets';
import { buildExportManifest } from './manifest';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportExitConfig } from './packaging';
import { buildExportLeafletMapSrcdoc } from './leaflet-map-srcdoc';
import { compileRuntime } from './runtime-script';
import { buildPortableProjectExport, type PortableExportScene, type PortableExportWidget } from './portable';

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

function widgetHtml(node: PortableExportWidget, state: StudioState, assetPathMap: Record<string, string>): string {
  return renderWidgetExport({
    node,
    state,
    assetPathMap,
    channel: state.document.metadata.release.targetChannel,
  });
}

function resolveExportFontSrc(src: unknown, assetPathMap?: Record<string, string>): string | null {
  if (typeof src !== 'string') return null;
  const trimmed = src.trim();
  if (!trimmed) return null;
  return assetPathMap?.[trimmed] ?? trimmed;
}

function inferFontMimeType(src: string): string {
  const normalized = src.toLowerCase();
  if (normalized.includes('.woff2')) return 'font/woff2';
  if (normalized.includes('.woff')) return 'font/woff';
  if (normalized.includes('.ttf')) return 'font/ttf';
  if (normalized.includes('.otf')) return 'font/otf';
  return 'font/woff2';
}

function collectPortableFonts(
  project: ReturnType<typeof buildPortableProjectExport>,
  assetPathMap?: Record<string, string>,
): Array<{ family: string; src: string }> {
  const seen = new Set<string>();
  const fonts: Array<{ family: string; src: string }> = [];

  project.scenes.forEach((scene) => {
    scene.widgets.forEach((widget) => {
      const family = typeof widget.style.fontFamily === 'string' ? widget.style.fontFamily.trim() : '';
      const src = resolveExportFontSrc(widget.props.fontAssetSrc, assetPathMap);
      if (!family || !src) return;
      const key = `${family}::${src}`;
      if (seen.has(key)) return;
      seen.add(key);
      fonts.push({ family, src });
    });
  });

  return fonts;
}

function buildPortableFontFaceCss(
  project: ReturnType<typeof buildPortableProjectExport>,
  assetPathMap?: Record<string, string>,
): string {
  return collectPortableFonts(project, assetPathMap)
    .map(({ family, src }) => buildFontFaceCss(family, src))
    .join('\n');
}

function buildPortableFontPreloadLinks(
  project: ReturnType<typeof buildPortableProjectExport>,
  assetPathMap?: Record<string, string>,
): string {
  return collectPortableFonts(project, assetPathMap)
    .map(({ src }) => src)
    .filter((src, index, items) => items.indexOf(src) === index)
    .map((src) => `<link rel="preload" href="${escapeHtml(src)}" as="font" type="${escapeHtml(inferFontMimeType(src))}" crossorigin />`)
    .join('\n');
}

function sceneHtml(
  scene: PortableExportScene,
  canvas: { width: number; height: number; backgroundColor: string },
  state: StudioState,
  assetPathMap: Record<string, string>,
  visibleByDefault = false,
): string {
  const widgetsById = buildResolvedWidgetsById(state.document);
  const isCoveredByScratchGroup = (widgetId: string): boolean => {
    let currentParentId = widgetsById[widgetId]?.parentId;
    while (currentParentId) {
      const parent = widgetsById[currentParentId];
      if (!parent) return false;
      if (parent.type === 'group' && Boolean(parent.props.scratchEnabled)) return true;
      currentParentId = parent.parentId;
    }
    return false;
  };

  const widgets = scene.widgets
    .filter((widget) => !widget.hidden && !isCoveredByScratchGroup(widget.id))
    .sort((a, b) => a.zIndex - b.zIndex);
  return `
    <section class="scene" data-scene-id="${scene.id}" data-scene-order="${scene.order}" style="position:absolute;inset:0;width:${canvas.width}px;height:${canvas.height}px;background:${escapeHtml(canvas.backgroundColor)};overflow:hidden;display:${visibleByDefault ? 'block' : 'none'};">
      ${widgets.map((widget) => `<div class="widget-layer" data-widget-layer-id="${widget.id}" style="position:absolute;inset:0;z-index:${widget.zIndex};">${widgetHtml(widget, state, assetPathMap)}</div>`).join('\n')}
    </section>
  `;
}

export function buildStandaloneHtml(state: StudioState): string {
  const manifest = buildExportManifest(state);
  const activeRecord = getActiveFeedRecord(state);
  const portableProject = buildPortableProjectExport(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(portableProject));
  const orderedScenes = [...portableProject.scenes].sort((a, b) => a.order - b.order);
  const exportFontCss = buildPortableFontFaceCss(portableProject, assetPathMap);
  const fontPreloads = buildPortableFontPreloadLinks(portableProject, assetPathMap);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.document.name || 'SMX Export')}</title>
  ${fontPreloads}
  <style>
    ${exportFontCss}
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

function getRuntimeProject(adapter: ExportHtmlAdapter) {
  return adapter.adapter === 'playable-ad' ? adapter.playableProject : adapter.portableProject;
}

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
  const runtimeScript = compileRuntime(getRuntimeProject(adapter), adapter);
  const exitBootstrap = buildExitBootstrap(adapter);
  const exportFontCss = buildPortableFontFaceCss(adapter.playableProject, resolvedAssetPathMap);
  const fontPreloads = buildPortableFontPreloadLinks(adapter.playableProject, resolvedAssetPathMap);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${escapeHtml(documentName)}</title>
  ${fontPreloads}
  <style>
    ${exportFontCss}
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
  const exportFontCss = buildPortableFontFaceCss(nonPlayableAdapter.portableProject, assetPathMap);
  const fontPreloads = buildPortableFontPreloadLinks(nonPlayableAdapter.portableProject, assetPathMap);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentName)}</title>
  ${fontPreloads}
  <style>
    ${exportFontCss}
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
