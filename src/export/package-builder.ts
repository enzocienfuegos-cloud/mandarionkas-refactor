import { getActiveFeedRecord, resolveWidgetSnapshot } from '../domain/document/resolvers';
import type { SceneNode, StudioState, WidgetNode } from '../domain/document/types';
import { getWidgetDefinition } from '../widgets/registry/widget-registry';
import { buildExportManifest } from './manifest';
import { buildExportModel } from './model';
import type { ExportAsset, ExportBuildOptions, ExportPackageBundle, ExportPackageFile } from './types';

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function decodeDataUrlContent(dataUrl: string): string | null {
  const match = dataUrl.match(/^data:([^;,]+)(;charset=[^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const isBase64 = Boolean(match[3]);
  const payload = match[4] ?? '';
  if (isBase64) {
    return atob(payload);
  }
  return decodeURIComponent(payload);
}

function buildAssetSourceMap(assets: ExportAsset[]): Record<string, string> {
  return Object.fromEntries(
    assets
      .filter((asset) => asset.packaging === 'bundled')
      .map((asset) => [asset.src, `./${asset.packagePath}`]),
  );
}

function replaceAssetSources(html: string, assets: ExportAsset[]): string {
  return Object.entries(buildAssetSourceMap(assets)).reduce((current, [source, packaged]) => current.split(source).join(packaged), html);
}

function widgetHtml(node: WidgetNode, state: StudioState): string {
  const definition = getWidgetDefinition(node.type);
  if (definition.renderExport) return definition.renderExport(node, state);

  const frame = node.frame;
  const style = node.style ?? {};
  const base = [
    'position:absolute',
    `left:${frame.x}px`,
    `top:${frame.y}px`,
    `width:${frame.width}px`,
    `height:${frame.height}px`,
    `transform:rotate(${frame.rotation}deg)`,
    `opacity:${Number(style.opacity ?? 1)}`,
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'overflow:hidden',
    'box-sizing:border-box',
    `border-radius:${Number(style.borderRadius ?? 12)}px`,
    `background:${String(style.backgroundColor ?? 'transparent')}`,
    `color:${String(style.color ?? '#ffffff')}`,
    `font-size:${Number(style.fontSize ?? 18)}px`,
    `font-weight:${Number(style.fontWeight ?? 700)}`,
    `border:1px solid ${String(style.borderColor ?? 'rgba(255,255,255,0.14)')}`,
    'padding:8px',
    'text-align:center',
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
    <section class="scene" data-scene-id="${scene.id}" style="position:relative;width:${state.document.canvas.width}px;height:${state.document.canvas.height}px;background:${escapeHtml(state.document.canvas.backgroundColor)};overflow:hidden;">
      ${widgets.map((widget) => widgetHtml(widget, state)).join('\n')}
    </section>
  `;
}

function buildStylesCss(): string {
  return `:root {
  color-scheme: dark;
  --dusk-bg: #0b1120;
  --dusk-panel: rgba(255,255,255,0.06);
  --dusk-border: rgba(255,255,255,0.08);
  --dusk-text: #e5e7eb;
  --dusk-muted: rgba(229,231,235,0.72);
}
* { box-sizing: border-box; }
html, body { margin: 0; min-height: 100%; }
body {
  font-family: Inter, Arial, sans-serif;
  background: var(--dusk-bg);
  color: var(--dusk-text);
}
.shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 32px;
  gap: 18px;
}
.meta {
  width: min(100%, 980px);
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.pill {
  padding: 8px 12px;
  border-radius: 999px;
  background: var(--dusk-panel);
  border: 1px solid var(--dusk-border);
  font-size: 12px;
}
.deck {
  position: relative;
}
.scene-card {
  position: absolute;
  inset: 0;
  display: grid;
  gap: 10px;
  opacity: 0;
  pointer-events: none;
  transform: translate3d(0, 0, 0);
  transition-property: opacity, transform;
  transition-timing-function: ease;
}
.scene-card.is-active,
.scene-card.is-entering,
.scene-card.is-leaving {
  display: grid;
}
.scene-card.is-active {
  opacity: 1;
  pointer-events: auto;
}
.scene-card.is-entering {
  opacity: 1;
  pointer-events: auto;
}
.scene-card.is-leaving {
  opacity: 0;
  pointer-events: none;
}
.scene-card.transition-fade.is-entering,
.scene-card.transition-fade.is-leaving {
  transform: translate3d(0, 0, 0);
}
.scene-card.transition-slide-left.is-entering {
  transform: translate3d(0, 0, 0);
}
.scene-card.transition-slide-left.is-leaving {
  transform: translate3d(-28px, 0, 0);
}
.scene-card.transition-slide-right.is-entering {
  transform: translate3d(0, 0, 0);
}
.scene-card.transition-slide-right.is-leaving {
  transform: translate3d(28px, 0, 0);
}
.scene-card.pre-enter.transition-fade {
  opacity: 0;
}
.scene-card.pre-enter.transition-slide-left {
  opacity: 0;
  transform: translate3d(28px, 0, 0);
}
.scene-card.pre-enter.transition-slide-right {
  opacity: 0;
  transform: translate3d(-28px, 0, 0);
}
.scene-title {
  font-weight: 800;
  font-size: 14px;
  letter-spacing: .04em;
  text-transform: uppercase;
  opacity: .8;
}
.scene {
  display: block;
  border-radius: 20px;
  border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 18px 45px rgba(0,0,0,.22);
}
.widget { position: absolute; }
.widget [data-target-key] {
  cursor: pointer;
}
.widget-exit-overlay {
  position: absolute;
  display: block;
  border: none;
  background: transparent;
  cursor: pointer;
  z-index: 50;
}
.widget-exit-overlay:focus-visible {
  outline: 2px solid rgba(103,232,249,.9);
  outline-offset: 2px;
}
.widget-degradation-marker {
  position: absolute;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: min(180px, 70%);
  padding: 5px 8px;
  border-radius: 999px;
  background: rgba(15,23,42,.88);
  border: 1px solid rgba(245,158,11,.45);
  color: #f8fafc;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: .03em;
  text-transform: uppercase;
  z-index: 60;
  pointer-events: none;
  box-shadow: 0 8px 20px rgba(15,23,42,.28);
}
.widget-degradation-marker::before {
  content: "!";
  width: 14px;
  height: 14px;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  background: rgba(245,158,11,.18);
  color: #fbbf24;
  font-size: 10px;
  font-weight: 900;
}
.widget button,
button.widget-cta {
  cursor: pointer;
}
.widget button:hover,
button.widget-cta:hover {
  filter: brightness(1.05);
}
@media (max-width: 840px) {
  .shell { padding: 18px; }
  .scene-card { overflow-x: auto; }
}`;
}

function buildRuntimeJs(): string {
  return `(() => {
  function readJsonScript(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent || 'null'); } catch { return null; }
  }

  const exportModel = readJsonScript('smx-export-model');
  if (!exportModel || !Array.isArray(exportModel.exits)) return;

  const scenesById = new Map();
  if (Array.isArray(exportModel.scenes)) {
    for (const scene of exportModel.scenes) {
      scenesById.set(scene.id, scene);
    }
  }

  const nodesById = new Map();
  if (Array.isArray(exportModel.nodes)) {
    for (const node of exportModel.nodes) {
      nodesById.set(node.widgetId, node);
    }
  }

  const orderedScenes = Array.isArray(exportModel.scenes)
    ? [...exportModel.scenes].sort((left, right) => Number(left.order || 0) - Number(right.order || 0))
    : [];
  let activeSceneId = exportModel.initialSceneId || (orderedScenes[0] && orderedScenes[0].id) || null;
  let sceneTimerId = null;
  let sceneTransitionCleanupId = null;
  let timedActionTimerIds = [];

  const sceneActionsByWidget = new Map();
  if (Array.isArray(exportModel.sceneActions)) {
    for (const action of exportModel.sceneActions) {
      const current = sceneActionsByWidget.get(action.sourceWidgetId) || [];
      current.push(action);
      sceneActionsByWidget.set(action.sourceWidgetId, current);
    }
  }

  const widgetActionsByWidget = new Map();
  if (Array.isArray(exportModel.widgetActions)) {
    for (const action of exportModel.widgetActions) {
      const current = widgetActionsByWidget.get(action.sourceWidgetId) || [];
      current.push(action);
      widgetActionsByWidget.set(action.sourceWidgetId, current);
    }
  }

  const textActionsByWidget = new Map();
  if (Array.isArray(exportModel.textActions)) {
    for (const action of exportModel.textActions) {
      const current = textActionsByWidget.get(action.sourceWidgetId) || [];
      current.push(action);
      textActionsByWidget.set(action.sourceWidgetId, current);
    }
  }

  function openExit(exit) {
    if (!exit || !exit.url) return;
    window.open(exit.url, '_blank', 'noopener,noreferrer');
  }

  function applyVisualPatch(element, patch) {
    if (!element || !patch) return;
    if (patch.backgroundColor !== undefined) element.style.background = patch.backgroundColor || '';
    if (patch.color !== undefined) element.style.color = patch.color || '';
    if (patch.borderColor !== undefined) element.style.borderColor = patch.borderColor || '';
    if (patch.opacity !== undefined) element.style.opacity = String(patch.opacity);
    if (patch.boxShadow !== undefined) element.style.boxShadow = patch.boxShadow || '';
  }

  function applyVisualState(element, node, stateName) {
    if (!element || !node || !node.visualStates) return;
    const base = node.visualStates.base || {};
    const patch = stateName === 'active'
      ? (node.visualStates.active || base)
      : stateName === 'hover'
        ? (node.visualStates.hover || base)
        : base;
    applyVisualPatch(element, base);
    if (patch !== base) applyVisualPatch(element, patch);
  }

  function applyTargetVisualState(targetEl, node, targetKey, stateName) {
    if (!targetEl || !node || !node.targetVisualStates || !targetKey) return;
    const visualStates = node.targetVisualStates[targetKey];
    if (!visualStates) return;
    const base = visualStates.base || {};
    const patch = stateName === 'active'
      ? (visualStates.active || base)
      : stateName === 'hover'
        ? (visualStates.hover || base)
        : base;
    applyVisualPatch(targetEl, base);
    if (patch !== base) applyVisualPatch(targetEl, patch);
  }

  function bindTargetVisualStates(targetEl, node, targetKey) {
    if (!targetEl || !node || !targetKey) return;
    applyTargetVisualState(targetEl, node, targetKey, 'base');
    targetEl.addEventListener('pointerenter', () => applyTargetVisualState(targetEl, node, targetKey, 'hover'));
    targetEl.addEventListener('pointerleave', () => applyTargetVisualState(targetEl, node, targetKey, 'base'));
    targetEl.addEventListener('pointerdown', () => applyTargetVisualState(targetEl, node, targetKey, 'active'));
    targetEl.addEventListener('pointerup', () => applyTargetVisualState(targetEl, node, targetKey, 'hover'));
    targetEl.addEventListener('blur', () => applyTargetVisualState(targetEl, node, targetKey, 'base'));
  }

  function appendDegradationMarker(sceneEl, node) {
    if (!sceneEl || !node || node.capabilityStatus !== 'degraded' || !node.degradationStrategy || node.hidden) return;
    const marker = document.createElement('div');
    const notes = Array.isArray(node.capabilityNotes) && node.capabilityNotes.length
      ? ' - ' + node.capabilityNotes[0]
      : '';
    marker.className = 'widget-degradation-marker';
    marker.setAttribute('data-widget-degradation-id', node.widgetId);
    marker.textContent = node.degradationStrategy + notes;
    marker.title = node.widgetName + ': ' + node.degradationStrategy + notes;
    marker.style.left = Math.max(6, Number(node.bounds.x || 0) + 6) + 'px';
    marker.style.top = Math.max(6, Number(node.bounds.y || 0) + 6) + 'px';
    sceneEl.appendChild(marker);
  }

  function clearSceneTimer() {
    if (!sceneTimerId) return;
    window.clearTimeout(sceneTimerId);
    sceneTimerId = null;
  }

  function clearSceneTransitionCleanup() {
    if (!sceneTransitionCleanupId) return;
    window.clearTimeout(sceneTransitionCleanupId);
    sceneTransitionCleanupId = null;
  }

  function clearTimedActionTimers() {
    timedActionTimerIds.forEach((timerId) => window.clearTimeout(timerId));
    timedActionTimerIds = [];
  }

  function getSceneById(sceneId) {
    return scenesById.get(sceneId) || null;
  }

  function getNodeByWidgetId(widgetId) {
    return nodesById.get(widgetId) || null;
  }

  function getNextSceneId(sceneId) {
    const index = orderedScenes.findIndex((scene) => scene.id === sceneId);
    if (index < 0) return orderedScenes[0] && orderedScenes[0].id;
    const next = orderedScenes[index + 1];
    return next ? next.id : null;
  }

  function getSceneCardById(sceneId) {
    return document.querySelector('[data-scene-card-id="' + escapeAttributeValue(sceneId) + '"]');
  }

  function getSceneTransition(sceneId) {
    const card = getSceneCardById(sceneId);
    const type = card && card.getAttribute('data-transition-type') || 'cut';
    const durationMs = Number(card && card.getAttribute('data-transition-duration') || 450);
    return {
      type,
      durationMs: Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 450,
    };
  }

  function scheduleSceneAdvance(sceneId) {
    clearSceneTimer();
    const scene = getSceneById(sceneId);
    const durationMs = Number(scene && scene.durationMs);
    if (!scene || !Number.isFinite(durationMs) || durationMs <= 0) return;
    const nextSceneId = getNextSceneId(sceneId);
    if (!nextSceneId || nextSceneId === sceneId) return;
    sceneTimerId = window.setTimeout(() => {
      setActiveScene(nextSceneId, { restartTimer: true });
    }, durationMs);
  }

  function scheduleTimedActionsForScene(sceneId) {
    clearTimedActionTimers();
    const timedSceneActions = Array.from(sceneActionsByWidget.values())
      .flat()
      .filter((action) => action.trigger === 'timeline-enter' && getNodeByWidgetId(action.sourceWidgetId) && getNodeByWidgetId(action.sourceWidgetId).sceneId === sceneId && Number.isFinite(Number(action.atMs)));
    const timedWidgetActions = Array.from(widgetActionsByWidget.values())
      .flat()
      .filter((action) => action.trigger === 'timeline-enter' && getNodeByWidgetId(action.sourceWidgetId) && getNodeByWidgetId(action.sourceWidgetId).sceneId === sceneId && Number.isFinite(Number(action.atMs)));
    const timedTextActions = Array.from(textActionsByWidget.values())
      .flat()
      .filter((action) => action.trigger === 'timeline-enter' && getNodeByWidgetId(action.sourceWidgetId) && getNodeByWidgetId(action.sourceWidgetId).sceneId === sceneId && Number.isFinite(Number(action.atMs)));

    timedSceneActions.forEach((action) => {
      const timerId = window.setTimeout(() => {
        setActiveScene(action.targetSceneId, { restartTimer: true });
      }, Math.max(0, Number(action.atMs || 0)));
      timedActionTimerIds.push(timerId);
    });

    timedWidgetActions.forEach((action) => {
      const timerId = window.setTimeout(() => {
        applyWidgetAction(action);
      }, Math.max(0, Number(action.atMs || 0)));
      timedActionTimerIds.push(timerId);
    });

    timedTextActions.forEach((action) => {
      const timerId = window.setTimeout(() => {
        applyTextAction(action);
      }, Math.max(0, Number(action.atMs || 0)));
      timedActionTimerIds.push(timerId);
    });
  }

  function setActiveScene(sceneId, options) {
    if (!sceneId) return;
    clearSceneTransitionCleanup();
    const previousSceneId = activeSceneId;
    activeSceneId = sceneId;
    const previousCard = previousSceneId ? getSceneCardById(previousSceneId) : null;
    const nextCard = getSceneCardById(sceneId);
    const transition = getSceneTransition(sceneId);

    document.querySelectorAll('[data-scene-card-id]').forEach((card) => {
      if (card !== previousCard && card !== nextCard) {
        card.classList.remove('is-active', 'is-entering', 'is-leaving', 'pre-enter', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
        card.setAttribute('hidden', 'hidden');
      }
    });

    if (!nextCard) return;

    nextCard.removeAttribute('hidden');
    nextCard.style.transitionDuration = transition.durationMs + 'ms';

    if (!previousCard || previousSceneId === sceneId || transition.type === 'cut') {
      if (previousCard && previousCard !== nextCard) previousCard.setAttribute('hidden', 'hidden');
      nextCard.classList.remove('is-entering', 'is-leaving', 'pre-enter', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
      nextCard.classList.add('is-active');
    } else {
      previousCard.removeAttribute('hidden');
      previousCard.style.transitionDuration = transition.durationMs + 'ms';
      previousCard.classList.remove('is-active', 'is-entering', 'pre-enter', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
      previousCard.classList.add('is-leaving', 'transition-' + transition.type);

      nextCard.classList.remove('is-active', 'is-leaving', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
      nextCard.classList.add('pre-enter', 'transition-' + transition.type);

      window.requestAnimationFrame(() => {
        nextCard.classList.add('is-entering');
        nextCard.classList.remove('pre-enter');
      });

      sceneTransitionCleanupId = window.setTimeout(() => {
        previousCard.classList.remove('is-leaving', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
        previousCard.setAttribute('hidden', 'hidden');
        nextCard.classList.remove('is-entering', 'transition-fade', 'transition-slide-left', 'transition-slide-right');
        nextCard.classList.add('is-active');
        sceneTransitionCleanupId = null;
      }, transition.durationMs);
    }

    document.querySelectorAll('[data-scene-id]').forEach((sceneEl) => {
      const matches = sceneEl.getAttribute('data-scene-id') === sceneId;
      if (matches) sceneEl.removeAttribute('hidden');
      else sceneEl.setAttribute('hidden', 'hidden');
    });
    if (!options || options.restartTimer !== false) {
      scheduleSceneAdvance(sceneId);
    }
    scheduleTimedActionsForScene(sceneId);
  }

  function setWidgetVisibility(widgetId, hidden) {
    if (!widgetId) return;
    const targetEl = document.querySelector('[data-widget-id="' + escapeAttributeValue(widgetId) + '"]');
    if (!targetEl) return;
    if (hidden) {
      targetEl.setAttribute('hidden', 'hidden');
      targetEl.style.display = 'none';
    } else {
      targetEl.removeAttribute('hidden');
      targetEl.style.display = '';
    }
  }

  function toggleWidgetVisibility(widgetId) {
    if (!widgetId) return;
    const targetEl = document.querySelector('[data-widget-id="' + escapeAttributeValue(widgetId) + '"]');
    if (!targetEl) return;
    const hidden = targetEl.hasAttribute('hidden') || targetEl.style.display === 'none';
    setWidgetVisibility(widgetId, !hidden);
  }

  function applyWidgetAction(widgetAction) {
    if (!widgetAction || !widgetAction.targetWidgetId) return;
    if (widgetAction.actionType === 'show-widget') {
      setWidgetVisibility(widgetAction.targetWidgetId, false);
      return;
    }
    if (widgetAction.actionType === 'hide-widget') {
      setWidgetVisibility(widgetAction.targetWidgetId, true);
      return;
    }
    if (widgetAction.actionType === 'toggle-widget') {
      toggleWidgetVisibility(widgetAction.targetWidgetId);
    }
  }

  function applyTextAction(textAction) {
    if (!textAction || !textAction.targetWidgetId) return;
    const targetEl = document.querySelector('[data-widget-id="' + escapeAttributeValue(textAction.targetWidgetId) + '"]');
    if (!targetEl) return;
    const primarySlot = targetEl.querySelector('[data-text-slot="primary"]');
    if (primarySlot) {
      primarySlot.textContent = textAction.text || '';
      return;
    }
    targetEl.textContent = textAction.text || '';
  }

  function escapeAttributeValue(value) {
    return String(value || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  function bindTargetElement(targetEl, exit) {
    if (!targetEl || !exit) return false;
    targetEl.setAttribute('role', targetEl.getAttribute('role') || 'button');
    targetEl.setAttribute('tabindex', targetEl.getAttribute('tabindex') || '0');
    targetEl.setAttribute('aria-label', exit.label || exit.targetKey || 'Open link');
    targetEl.setAttribute('data-exit-id', exit.id);
    targetEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExit(exit);
    });
    targetEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      openExit(exit);
    });
    return true;
  }

  function bindSceneTargetElement(targetEl, sceneAction) {
    if (!targetEl || !sceneAction) return false;
    targetEl.setAttribute('role', targetEl.getAttribute('role') || 'button');
    targetEl.setAttribute('tabindex', targetEl.getAttribute('tabindex') || '0');
    targetEl.setAttribute('aria-label', sceneAction.label || 'Change scene');
    targetEl.setAttribute('data-scene-action-id', sceneAction.id);
    targetEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveScene(sceneAction.targetSceneId);
    });
    targetEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      setActiveScene(sceneAction.targetSceneId);
    });
    return true;
  }

  function bindWidgetTargetElement(targetEl, widgetAction) {
    if (!targetEl || !widgetAction) return false;
    targetEl.setAttribute('role', targetEl.getAttribute('role') || 'button');
    targetEl.setAttribute('tabindex', targetEl.getAttribute('tabindex') || '0');
    targetEl.setAttribute('aria-label', widgetAction.label || widgetAction.actionType || 'Widget action');
    targetEl.setAttribute('data-widget-action-id', widgetAction.id);
    targetEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyWidgetAction(widgetAction);
    });
    targetEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      applyWidgetAction(widgetAction);
    });
    return true;
  }

  function bindTextTargetElement(targetEl, textAction) {
    if (!targetEl || !textAction) return false;
    targetEl.setAttribute('role', targetEl.getAttribute('role') || 'button');
    targetEl.setAttribute('tabindex', targetEl.getAttribute('tabindex') || '0');
    targetEl.setAttribute('aria-label', textAction.label || 'Set text');
    targetEl.setAttribute('data-text-action-id', textAction.id);
    targetEl.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyTextAction(textAction);
    });
    targetEl.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      applyTextAction(textAction);
    });
    return true;
  }

  function createOverlay(exit, sceneEl, node) {
    if (!sceneEl || !node || !exit || !exit.bounds) return;
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'widget-exit-overlay';
    overlay.setAttribute('aria-label', exit.label || exit.targetKey || 'Open link');
    overlay.setAttribute('data-exit-id', exit.id);
    overlay.setAttribute('data-target-key', exit.targetKey || '');
    const left = exit.bounds.x - node.bounds.x;
    const top = exit.bounds.y - node.bounds.y;
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = exit.bounds.width + 'px';
    overlay.style.height = exit.bounds.height + 'px';
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      openExit(exit);
    });
    sceneEl.appendChild(overlay);
  }

  function createSceneOverlay(sceneAction, sceneEl, node) {
    if (!sceneEl || !node || !sceneAction || !sceneAction.bounds) return;
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'widget-exit-overlay';
    overlay.setAttribute('aria-label', sceneAction.label || sceneAction.targetKey || 'Change scene');
    overlay.setAttribute('data-scene-action-id', sceneAction.id);
    overlay.setAttribute('data-target-key', sceneAction.targetKey || '');
    const left = sceneAction.bounds.x - node.bounds.x;
    const top = sceneAction.bounds.y - node.bounds.y;
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = sceneAction.bounds.width + 'px';
    overlay.style.height = sceneAction.bounds.height + 'px';
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveScene(sceneAction.targetSceneId);
    });
    sceneEl.appendChild(overlay);
  }

  function createWidgetActionOverlay(widgetAction, sceneEl, node) {
    if (!sceneEl || !node || !widgetAction || !widgetAction.bounds) return;
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'widget-exit-overlay';
    overlay.setAttribute('aria-label', widgetAction.label || widgetAction.actionType || 'Widget action');
    overlay.setAttribute('data-widget-action-id', widgetAction.id);
    overlay.setAttribute('data-target-key', widgetAction.targetKey || '');
    const left = widgetAction.bounds.x - node.bounds.x;
    const top = widgetAction.bounds.y - node.bounds.y;
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = widgetAction.bounds.width + 'px';
    overlay.style.height = widgetAction.bounds.height + 'px';
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyWidgetAction(widgetAction);
    });
    sceneEl.appendChild(overlay);
  }

  function createTextActionOverlay(textAction, sceneEl, node) {
    if (!sceneEl || !node || !textAction || !textAction.bounds) return;
    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'widget-exit-overlay';
    overlay.setAttribute('aria-label', textAction.label || 'Set text');
    overlay.setAttribute('data-text-action-id', textAction.id);
    overlay.setAttribute('data-target-key', textAction.targetKey || '');
    const left = textAction.bounds.x - node.bounds.x;
    const top = textAction.bounds.y - node.bounds.y;
    overlay.style.left = left + 'px';
    overlay.style.top = top + 'px';
    overlay.style.width = textAction.bounds.width + 'px';
    overlay.style.height = textAction.bounds.height + 'px';
    overlay.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      applyTextAction(textAction);
    });
    sceneEl.appendChild(overlay);
  }

  setActiveScene(activeSceneId, { restartTimer: true });

  Array.from(nodesById.values()).forEach((node) => {
    const sceneEl = document.querySelector('[data-scene-id="' + escapeAttributeValue(node.sceneId) + '"]');
    appendDegradationMarker(sceneEl, node);
  });

  document.querySelectorAll('[data-widget-id]').forEach((element) => {
    const widgetId = element.getAttribute('data-widget-id');
    if (!widgetId) return;
    const node = nodesById.get(widgetId);
    if (!node) return;
    const widgetExits = exportModel.exits.filter((exit) => exit.sourceWidgetId === widgetId);
    const widgetSceneActions = sceneActionsByWidget.get(widgetId) || [];
    const widgetStateActions = widgetActionsByWidget.get(widgetId) || [];
    const widgetTextActions = textActionsByWidget.get(widgetId) || [];
    element.setAttribute('data-exit-count', String(widgetExits.length));
    const sceneEl = element.closest('[data-scene-id]');
    applyVisualState(element, node, 'base');
    element.addEventListener('pointerenter', () => applyVisualState(element, node, 'hover'));
    element.addEventListener('pointerleave', () => applyVisualState(element, node, 'base'));
    element.addEventListener('pointerdown', () => applyVisualState(element, node, 'active'));
    element.addEventListener('pointerup', () => applyVisualState(element, node, 'hover'));
    element.addEventListener('blur', () => applyVisualState(element, node, 'base'));
    if (widgetExits.some((exit) => exit.targetKey)) {
      widgetExits.forEach((exit) => {
        if (!exit.targetKey) return;
        const targetEl = element.querySelector('[data-target-key="' + escapeAttributeValue(exit.targetKey) + '"]');
        if (targetEl) bindTargetVisualStates(targetEl, node, exit.targetKey);
        const boundToDom = bindTargetElement(targetEl, exit);
        if (!boundToDom) createOverlay(exit, sceneEl, node);
      });
    } else {
      const primaryExit = widgetExits[0];
      if (primaryExit) {
        element.addEventListener('click', (event) => {
          if (!primaryExit.url) return;
          event.preventDefault();
          openExit(primaryExit);
        });
      }
    }

    if (widgetSceneActions.some((action) => action.targetKey)) {
      widgetSceneActions.forEach((sceneAction) => {
        if (!sceneAction.targetKey) return;
        const targetEl = element.querySelector('[data-target-key="' + escapeAttributeValue(sceneAction.targetKey) + '"]');
        if (targetEl) bindTargetVisualStates(targetEl, node, sceneAction.targetKey);
        const boundToDom = bindSceneTargetElement(targetEl, sceneAction);
        if (!boundToDom) createSceneOverlay(sceneAction, sceneEl, node);
      });
    }

    const primarySceneAction = widgetSceneActions[0];
    if (primarySceneAction) {
      element.addEventListener('click', (event) => {
        if (widgetExits.length) return;
        event.preventDefault();
        event.stopPropagation();
        setActiveScene(primarySceneAction.targetSceneId);
      });
    }

    if (widgetStateActions.some((action) => action.targetKey)) {
      widgetStateActions.forEach((widgetAction) => {
        if (!widgetAction.targetKey) return;
        const targetEl = element.querySelector('[data-target-key="' + escapeAttributeValue(widgetAction.targetKey) + '"]');
        if (targetEl) bindTargetVisualStates(targetEl, node, widgetAction.targetKey);
        const boundToDom = bindWidgetTargetElement(targetEl, widgetAction);
        if (!boundToDom) createWidgetActionOverlay(widgetAction, sceneEl, node);
      });
    }

    const primaryWidgetAction = widgetStateActions[0];
    if (primaryWidgetAction) {
      element.addEventListener('click', (event) => {
        if (widgetExits.length || widgetSceneActions.length) return;
        event.preventDefault();
        event.stopPropagation();
        applyWidgetAction(primaryWidgetAction);
      });
    }

    if (widgetTextActions.some((action) => action.targetKey)) {
      widgetTextActions.forEach((textAction) => {
        if (!textAction.targetKey) return;
        const targetEl = element.querySelector('[data-target-key="' + escapeAttributeValue(textAction.targetKey) + '"]');
        if (targetEl) bindTargetVisualStates(targetEl, node, textAction.targetKey);
        const boundToDom = bindTextTargetElement(targetEl, textAction);
        if (!boundToDom) createTextActionOverlay(textAction, sceneEl, node);
      });
    }

    const primaryTextAction = widgetTextActions[0];
    if (primaryTextAction) {
      element.addEventListener('click', (event) => {
        if (widgetExits.length || widgetSceneActions.length || widgetStateActions.length) return;
        event.preventDefault();
        event.stopPropagation();
        applyTextAction(primaryTextAction);
      });
    }
  });
})();`;
}

function buildIndexHtml(state: StudioState, options: ExportBuildOptions = {}): string {
  const manifest = buildExportManifest(state, options);
  const exportModel = buildExportModel(state, options);
  const activeRecord = getActiveFeedRecord(state);
  const orderedScenes = [...state.document.scenes].sort((a, b) => a.order - b.order);

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(state.document.name || 'Dusk Export')}</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <div class="shell">
    <div class="meta">
      <div class="pill">${escapeHtml(state.document.name)}</div>
      <div class="pill">Variant ${escapeHtml(state.ui.activeVariant)}</div>
      <div class="pill">Feed ${escapeHtml(state.ui.activeFeedSource)} / ${escapeHtml(activeRecord?.label ?? state.ui.activeFeedRecordId)}</div>
      <div class="pill">Scenes ${orderedScenes.length}</div>
      <div class="pill">Widgets ${Object.keys(state.document.widgets).length}</div>
      <div class="pill">Exits ${exportModel.exits.length}</div>
      <div class="pill">Assets ${exportModel.assets.length}</div>
      <div class="pill">Tier ${escapeHtml(exportModel.interactionTier)}</div>
      <div class="pill">Quality ${escapeHtml(exportModel.qualityProfile)}</div>
    </div>
    <div class="deck" style="width:${state.document.canvas.width}px;min-height:${state.document.canvas.height + 34}px;">
      ${orderedScenes.map((scene) => `<div class="scene-card" data-scene-card-id="${scene.id}" data-transition-type="${escapeHtml(scene.transition?.type ?? 'cut')}" data-transition-duration="${escapeHtml(String(scene.transition?.durationMs ?? 450))}"><div class="scene-title">${escapeHtml(scene.name)}</div>${sceneHtml(scene, state)}</div>`).join('\n')}
    </div>
  </div>
  <script type="application/json" id="smx-export-manifest">${escapeHtml(JSON.stringify(manifest, null, 2))}</script>
  <script type="application/json" id="smx-export-model">${escapeHtml(JSON.stringify(exportModel, null, 2))}</script>
  <script src="./runtime.js"></script>
</body>
</html>`;
  return replaceAssetSources(html, exportModel.assets);
}

function buildAssetFiles(assets: ExportAsset[]): ExportPackageFile[] {
  return assets.flatMap((asset) => {
    if (asset.packaging !== 'bundled') return [];
    const content = decodeDataUrlContent(asset.src);
    if (content == null) return [];
    return [{
      path: asset.packagePath,
      mime: `${asset.mime ?? 'application/octet-stream'};charset=utf-8`,
      content,
    }];
  });
}

export function buildPackageBundle(state: StudioState, options: ExportBuildOptions = {}): ExportPackageBundle {
  const manifest = buildExportManifest(state, options);
  const exportModel = buildExportModel(state, options);
  const bundledAssets = buildAssetFiles(exportModel.assets);
  const files: ExportPackageFile[] = [
    {
      path: 'index.html',
      mime: 'text/html;charset=utf-8',
      content: buildIndexHtml(state, options),
    },
    {
      path: 'styles.css',
      mime: 'text/css;charset=utf-8',
      content: buildStylesCss(),
    },
    {
      path: 'runtime.js',
      mime: 'application/javascript;charset=utf-8',
      content: buildRuntimeJs(),
    },
    {
      path: 'manifest.json',
      mime: 'application/json;charset=utf-8',
      content: JSON.stringify(manifest, null, 2),
    },
    {
      path: 'asset-map.json',
      mime: 'application/json;charset=utf-8',
      content: JSON.stringify(exportModel.assets.map((asset) => ({
        id: asset.id,
        widgetId: asset.widgetId,
        kind: asset.kind,
        qualityProfile: exportModel.qualityProfile,
        qualityHint: asset.qualityHint,
        source: asset.source,
        linkedAssetId: asset.linkedAssetId,
        packagePath: asset.packagePath,
        packaging: asset.packaging,
        originalSrc: asset.src,
        mime: asset.mime,
      })), null, 2),
    },
    ...bundledAssets,
  ];

  return {
    entry: 'index.html',
    files,
  };
}
