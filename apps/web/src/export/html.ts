import { getActiveFeedRecord } from '../domain/document/resolvers';
import type { StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import type { GamHtml5AdapterResult, GenericHtml5AdapterResult, GoogleDisplayAdapterResult, PlayableExportAdapterResult } from './adapters';
import { buildExportAssetPathMap, buildExportAssetPlan } from './assets';
import { buildExportManifest } from './manifest';
import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { buildExportExitConfig } from './packaging';
import { buildPortableProjectExport, type PortableExportScene, type PortableExportWidget } from './portable';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function resolveAssetPath(src: unknown, assetPathMap: Record<string, string>): string {
  if (typeof src !== 'string') return '';
  return assetPathMap[src] ?? src;
}

function parseCarouselSlides(raw: unknown, assetPathMap: Record<string, string>): Array<{ src: string; caption: string }> {
  if (typeof raw !== 'string' || raw.trim().length === 0) return [];
  return raw
    .split(';')
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item, index) => {
      const [src, caption] = item.split('|');
      return {
        src: resolveAssetPath((src ?? '').trim(), assetPathMap),
        caption: (caption ?? `Slide ${index + 1}`).trim(),
      };
    })
    .filter((item) => item.src);
}

function renderImageWidget(node: WidgetNode, assetPathMap: Record<string, string>, kind: 'image' | 'hero-image'): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const src = resolveAssetPath(node.props.src, assetPathMap);
  const alt = escapeHtml(String(node.props.alt ?? (kind === 'hero-image' ? 'Hero image' : 'Image')));
  const fit = kind === 'hero-image' ? 'cover' : String(node.props.fit ?? 'cover');
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? 'transparent')}`,
  ].join(';');

  return `<div class="widget widget-${kind}" data-widget-id="${node.id}" style="${base}"><img src="${escapeHtml(src)}" alt="${alt}" style="width:100%;height:100%;display:block;object-fit:${escapeHtml(fit)};" /></div>`;
}

function renderVideoWidget(node: WidgetNode, assetPathMap: Record<string, string>): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const src = resolveAssetPath(node.props.src, assetPathMap);
  const posterSrc = resolveAssetPath(node.props.posterSrc, assetPathMap);
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? '#000000')}`,
  ].join(';');

  return `<div class="widget widget-video-hero" data-widget-id="${node.id}" style="${base}"><video src="${escapeHtml(src)}" ${posterSrc ? `poster="${escapeHtml(posterSrc)}"` : ''} ${Boolean(node.props.autoplay ?? true) ? 'autoplay' : ''} ${Boolean(node.props.muted ?? true) ? 'muted' : ''} ${Boolean(node.props.loop ?? true) ? 'loop' : ''} ${Boolean(node.props.controls ?? false) ? 'controls' : ''} playsinline style="width:100%;height:100%;display:block;object-fit:cover;"></video></div>`;
}

function renderCarouselWidget(node: WidgetNode, assetPathMap: Record<string, string>): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const slides = parseCarouselSlides(node.props.slides, assetPathMap);
  const accent = String(style.accentColor ?? '#ffffff');
  const activeSlide = slides[0];
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');
  const slidesJson = escapeHtml(JSON.stringify(slides));

  return `<div class="widget widget-image-carousel" data-widget-id="${node.id}" data-carousel-slides="${slidesJson}" data-carousel-index="0" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="position:relative;flex:1;margin:8px 12px 12px;border-radius:12px;overflow:hidden;background:#111827;">
      ${activeSlide ? `<img data-carousel-image src="${escapeHtml(activeSlide.src)}" alt="${escapeHtml(activeSlide.caption)}" style="width:100%;height:100%;display:block;object-fit:cover;" />` : '<div style="width:100%;height:100%;display:grid;place-items:center;opacity:.7;">Add slides</div>'}
      <div style="position:absolute;inset-inline:12px;bottom:10px;display:flex;justify-content:space-between;align-items:end;gap:8px;">
        <div data-carousel-caption style="border-radius:10px;padding:8px 10px;background:rgba(15,23,42,.68);font-size:12px;">${escapeHtml(activeSlide?.caption ?? 'No slide')}</div>
        <div style="display:flex;gap:6px;">${slides.map((_, index) => `<button type="button" data-smx-action="carousel-dot" data-widget-id="${node.id}" data-carousel-target="${index}" style="width:10px;height:10px;border-radius:50%;border:none;background:${index === 0 ? escapeHtml(accent) : 'rgba(255,255,255,.45)'};cursor:pointer;"></button>`).join('')}</div>
      </div>
    </div>
    <div style="display:flex;gap:8px;padding:0 12px 12px;">
      <button type="button" data-smx-action="carousel-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>
      <button type="button" data-smx-action="carousel-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:#111827;font-weight:800;padding:8px 10px;">Next</button>
    </div>
  </div>`;
}

function renderHotspotWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f59e0b');
  const hotspotX = Number(node.props.hotspotX ?? 55);
  const hotspotY = Number(node.props.hotspotY ?? 45);
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#172554')}`,
    `color:${String(style.color ?? '#ffffff')}`,
  ].join(';');

  return `<div class="widget widget-interactive-hotspot" data-widget-id="${node.id}" style="${base}">
    <button type="button" data-smx-action="hotspot-toggle" data-widget-id="${node.id}" style="position:absolute;left:${hotspotX}%;top:${hotspotY}%;transform:translate(-50%,-50%);width:22px;height:22px;border-radius:50%;border:none;background:${escapeHtml(accent)};box-shadow:0 0 0 6px ${escapeHtml(accent)}33,0 0 0 18px ${escapeHtml(accent)}11;cursor:pointer;"></button>
    <div data-hotspot-panel style="position:absolute;left:12px;right:12px;bottom:12px;border-radius:10px;background:rgba(17,24,39,.92);padding:8px 10px;font-size:12px;display:none;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
    <div data-hotspot-label style="position:absolute;left:12px;bottom:12px;font-size:12px;">${escapeHtml(String(node.props.label ?? 'Tap point'))}</div>
  </div>`;
}

function renderRangeLikeWidget(node: WidgetNode, label: string): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#ffffff');
  const min = Number(node.props.min ?? 0);
  const max = Number(node.props.max ?? 100);
  const value = Number(node.props.value ?? node.props.current ?? 50);
  const units = String(node.props.units ?? '');
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-${escapeHtml(node.type)}" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <input type="range" min="${min}" max="${max}" value="${value}" data-smx-action="range-update" data-widget-id="${node.id}" data-units="${escapeHtml(units)}" style="accent-color:${escapeHtml(accent)};" />
      <div data-range-value style="font-size:13px;font-weight:700;">${escapeHtml(label)}: ${value}${escapeHtml(units)}</div>
    </div>
  </div>`;
}

function renderScratchRevealWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f97316');
  const revealAmount = Number(node.props.revealAmount ?? 55);
  const coverLabel = String(node.props.coverLabel ?? 'Scratch to reveal');
  const revealLabel = String(node.props.revealLabel ?? '20% off today');
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#111827')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-scratch-reveal" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;justify-content:center;gap:10px;">
      <div style="position:relative;flex:1;border-radius:12px;overflow:hidden;background:linear-gradient(135deg, ${escapeHtml(accent)}22, rgba(255,255,255,.12));">
        <div style="position:absolute;inset:0;display:grid;place-items:center;font-weight:800;font-size:22px;">${escapeHtml(revealLabel)}</div>
        <div data-scratch-cover style="position:absolute;inset:0;background:linear-gradient(135deg, #e5e7eb, #9ca3af);clip-path:inset(0 ${Math.max(0, 100 - revealAmount)}% 0 0);"></div>
        <div style="position:absolute;left:12px;right:12px;bottom:12px;display:flex;flex-direction:column;gap:6px;">
          <div style="font-size:12px;">${escapeHtml(coverLabel)}</div>
          <input type="range" min="0" max="100" value="${revealAmount}" data-smx-action="scratch-update" data-widget-id="${node.id}" />
        </div>
      </div>
    </div>
  </div>`;
}

function renderCountdownWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#f59e0b');
  const totalSeconds = Number(
    node.props.totalSeconds ??
      (Number(node.props.days ?? 0) * 86400) +
        (Number(node.props.hours ?? 0) * 3600) +
        (Number(node.props.minutes ?? 0) * 60) +
        Number(node.props.seconds ?? 0),
  );
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#1f2937')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-countdown" data-widget-id="${node.id}" data-countdown-seconds="${totalSeconds}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;flex:1;align-content:center;">
      ${['DD', 'HH', 'MM', 'SS'].map((label) => `
        <div data-countdown-segment="${label}" style="border-radius:12px;padding:12px 8px;background:rgba(255,255,255,0.08);display:grid;gap:4px;">
          <div data-countdown-value="${label}" style="font-size:20px;font-weight:800;text-align:center;">00</div>
          <div style="font-size:10px;text-align:center;opacity:.75;">${label}</div>
        </div>
      `).join('')}
    </div>
  </div>`;
}

function renderButtonsWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#67e8f9');
  const vertical = String(node.props.orientation ?? 'horizontal') === 'vertical';
  const primaryLabel = String(node.props.primaryLabel ?? 'Primary');
  const secondaryLabel = String(node.props.secondaryLabel ?? 'Secondary');
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#0f766e')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-buttons" data-widget-id="${node.id}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;align-items:center;justify-content:center;">
      <div style="display:flex;gap:8px;flex-direction:${vertical ? 'column' : 'row'};width:100%;">
        <button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="primary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:none;background:${escapeHtml(accent)};color:#111827;">${escapeHtml(primaryLabel)}</button>
        <button type="button" class="widget-buttons-action" data-smx-action="button-select" data-widget-id="${node.id}" data-button-kind="secondary" style="flex:1;padding:10px 12px;border-radius:12px;text-align:center;font-weight:800;cursor:pointer;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;">${escapeHtml(secondaryLabel)}</button>
      </div>
    </div>
  </div>`;
}

function renderInteractiveGalleryWidget(node: WidgetNode): string {
  const frame = node.frame;
  const style = node.style ?? {};
  const accent = String(style.accentColor ?? '#111827');
  const itemCount = Math.max(2, Math.min(6, Number(node.props.itemCount ?? 4)));
  const activeIndex = Math.max(0, Math.min(itemCount - 1, Number(node.props.activeIndex ?? 1) - 1));
  const base = [
    `position:absolute`,
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    `overflow:hidden`,
    `box-sizing:border-box`,
    `border-radius:${Number(style.borderRadius ?? 14)}px`,
    `background:${String(style.backgroundColor ?? '#ffffff')}`,
    `color:${String(style.color ?? '#111827')}`,
    `display:flex`,
    `flex-direction:column`,
  ].join(';');

  return `<div class="widget widget-interactive-gallery" data-widget-id="${node.id}" data-gallery-count="${itemCount}" data-gallery-index="${activeIndex}" style="${base}">
    <div style="padding:10px 12px 0;font-size:12px;font-weight:800;letter-spacing:.04em;text-transform:uppercase;color:${escapeHtml(accent)};">${escapeHtml(String(node.props.title ?? node.name))}</div>
    <div style="padding:8px 12px 12px;display:flex;flex:1;flex-direction:column;gap:10px;">
      <div data-gallery-card style="flex:1;border-radius:12px;background:linear-gradient(135deg, ${escapeHtml(accent)}55, rgba(255,255,255,.08));display:grid;place-items:center;font-size:26px;font-weight:900;">${activeIndex + 1} / ${itemCount}</div>
      <div style="display:flex;gap:8px;">
        <button type="button" data-smx-action="gallery-prev" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:1px solid ${escapeHtml(accent)};background:transparent;color:inherit;padding:8px 10px;">Prev</button>
        <button type="button" data-smx-action="gallery-next" data-widget-id="${node.id}" style="flex:1;border-radius:10px;border:none;background:${escapeHtml(accent)};color:${String(style.backgroundColor ?? '#ffffff')};padding:8px 10px;font-weight:800;">Next</button>
      </div>
    </div>
  </div>`;
}

function widgetHtml(node: PortableExportWidget, state: StudioState, assetPathMap: Record<string, string>): string {
  if (node.type === 'image') return renderImageWidget(node, assetPathMap, 'image');
  if (node.type === 'hero-image') return renderImageWidget(node, assetPathMap, 'hero-image');
  if (node.type === 'video-hero') return renderVideoWidget(node, assetPathMap);
  if (node.type === 'buttons') return renderButtonsWidget(node);
  if (node.type === 'interactive-gallery') return renderInteractiveGalleryWidget(node);
  if (node.type === 'image-carousel') return renderCarouselWidget(node, assetPathMap);
  if (node.type === 'interactive-hotspot') return renderHotspotWidget(node);
  if (node.type === 'countdown') return renderCountdownWidget(node);
  if (node.type === 'range-slider') return renderRangeLikeWidget(node, 'Range');
  if (node.type === 'slider') return renderRangeLikeWidget(node, 'Slider');
  if (node.type === 'scratch-reveal') return renderScratchRevealWidget(node);
  const definition = getWidgetDefinition(node.type);
  if (definition.renderExport) {
    return definition.renderExport(node as unknown as WidgetNode, state);
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
  | PlayableExportAdapterResult;

function getPrimaryClickthroughUrl(adapter: ExportHtmlAdapter): string {
  if (adapter.adapter === 'playable-ad') {
    return adapter.bootstrap.clickthroughs[0]?.url ?? 'https://example.com';
  }
  return adapter.portableProject.interactions.find((interaction) => interaction.type === 'open-url')?.url ?? 'https://example.com';
}

function buildExitBootstrap(adapter: ExportHtmlAdapter): string {
  const fallbackUrl = JSON.stringify(getPrimaryClickthroughUrl(adapter));
  switch (adapter.adapter) {
    case 'gam-html5':
      return `
    window.clickTag = window.clickTag || ${fallbackUrl};
    window.smxExit = function smxExit(url) {
      var target = url || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'google-display':
      return `
    window.clickTag = window.clickTag || ${fallbackUrl};
    window.smxExit = function smxExit(url) {
      var target = url || window.clickTag || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'generic-html5':
      return `
    window.smxExit = function smxExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    case 'playable-ad':
      return `
    window.smxPlayableExit = function smxPlayableExit(url) {
      var target = url || ${fallbackUrl};
      if (!target) return;
      if (typeof window.open === 'function') window.open(target, '_blank');
    };`;
    default:
      return '';
  }
}

export function buildChannelHtml(state: StudioState, adapter: ExportHtmlAdapter): string {
  const manifest = buildExportManifest(state);
  const runtimeModel = buildExportRuntimeModelFromPortable(adapter.portableProject);
  const exitConfig = buildExportExitConfig(adapter);
  const activeRecord = getActiveFeedRecord(state);
  const assetPathMap = buildExportAssetPathMap(buildExportAssetPlan(adapter.portableProject));
  const orderedScenes = [...adapter.portableProject.scenes].sort((a, b) => a.order - b.order);
  const exitBootstrap = buildExitBootstrap(adapter);
  const canvas = adapter.portableProject.canvas;
  const documentName = adapter.portableProject.name || state.document.name || 'SMX Export';

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(documentName)}</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Inter, Arial, sans-serif; background: transparent; color: #e5e7eb; }
    .banner-shell { width: ${canvas.width}px; height: ${canvas.height}px; position: relative; overflow: hidden; background: ${escapeHtml(canvas.backgroundColor)}; }
    .banner-stage { width: 100%; height: 100%; position: relative; overflow: hidden; }
    .scene { display: none; }
    button.widget-cta:hover { filter: brightness(1.05); }
  </style>
</head>
<body>
  <div class="banner-shell" data-document-name="${escapeHtml(documentName)}" data-active-variant="${escapeHtml(adapter.portableProject.activeVariant)}" data-active-feed="${escapeHtml(adapter.portableProject.activeFeedSource)}" data-active-record="${escapeHtml(activeRecord?.label ?? adapter.portableProject.activeFeedRecordId)}" data-adapter="${escapeHtml(adapter.adapter)}">
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
