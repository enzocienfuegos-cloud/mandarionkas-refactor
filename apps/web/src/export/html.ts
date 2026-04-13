import { getActiveFeedRecord, resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { SceneNode, StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
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

export function buildStandaloneHtml(state: StudioState): string {
  const manifest = buildExportManifest(state);
  const activeRecord = getActiveFeedRecord(state);
  const orderedScenes = [...state.document.scenes].sort((a, b) => a.order - b.order);
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
      ${orderedScenes.map((scene) => `<div class="scene-card"><div class="scene-title">${escapeHtml(scene.name)}</div>${sceneHtml(scene, state)}</div>`).join('\n')}
    </div>
  </div>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
</body>
</html>`;
}
