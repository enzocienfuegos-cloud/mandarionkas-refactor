import { buildExportExitConfig } from './packaging';
import type { ExportHtmlAdapter } from './html';
import {
  EXPORT_RUNTIME_ENVIRONMENT_SECTION,
  EXPORT_RUNTIME_INTERACTIVE_SECTION,
  EXPORT_RUNTIME_MAP_SECTION,
} from './runtime-script-sections';

export function buildExportRuntimeScript(adapter: ExportHtmlAdapter): string {
  const exitConfig = buildExportExitConfig(adapter);
  const fallbackUrl = JSON.stringify(exitConfig.primaryUrl ?? '');

  return `(() => {
  const runtimeNode = document.getElementById('smx-runtime-model');
  const exitNode = document.getElementById('smx-exit-config');
  const runtime = runtimeNode ? JSON.parse(runtimeNode.textContent || '{}') : {};
  const exitConfig = exitNode ? JSON.parse(exitNode.textContent || '{}') : { strategy: ${JSON.stringify(exitConfig.strategy)}, primaryUrl: ${fallbackUrl}, urls: [] };
  const scenes = Array.from(document.querySelectorAll('[data-scene-id]'));
  let activeSceneIndex = 0;
  let sceneTimer = 0;

  function getRuntimeScene(index) {
    if (!runtime || !Array.isArray(runtime.scenes)) return null;
    return runtime.scenes[index] || null;
  }

  function findSceneIndexById(sceneId) {
    if (!sceneId) return -1;
    return scenes.findIndex((scene) => scene.getAttribute('data-scene-id') === sceneId);
  }

  function clearSceneTimer() {
    if (sceneTimer) {
      window.clearTimeout(sceneTimer);
      sceneTimer = 0;
    }
  }

  function scheduleSceneAdvance() {
    clearSceneTimer();
    const sceneRuntime = getRuntimeScene(activeSceneIndex);
    if (!sceneRuntime) return;
    const durationMs = Math.max(0, Number(sceneRuntime.durationMs || 0));
    if (!durationMs) return;
    sceneTimer = window.setTimeout(() => {
      const targetIndex = sceneRuntime.nextSceneId ? findSceneIndexById(sceneRuntime.nextSceneId) : -1;
      if (targetIndex >= 0 && targetIndex !== activeSceneIndex) {
        showScene(targetIndex);
        return;
      }
      if (scenes.length > 1) {
        nextScene();
      }
    }, durationMs);
  }

  function resolveExitUrl(widgetId) {
    if (runtime && Array.isArray(runtime.interactions)) {
      const interaction = runtime.interactions.find((item) => item.widgetId === widgetId && item.kind === 'clickthrough' && item.url);
      if (interaction && interaction.url) return interaction.url;
    }
    return exitConfig.primaryUrl || ${fallbackUrl};
  }

  function performExit(url) {
    const target = url || exitConfig.primaryUrl || ${fallbackUrl};
    if (!target) return;
    if (exitConfig.strategy === 'playable-bridge' && typeof window.smxPlayableExit === 'function') {
      window.smxPlayableExit(target);
      return;
    }
    if (exitConfig.strategy === 'clickTag') {
      window.clickTag = window.clickTag || target;
      if (typeof window.smxExit === 'function') {
        window.smxExit(target);
        return;
      }
    }
    if (typeof window.open === 'function') window.open(target, '_blank');
  }

  function showScene(index) {
    if (!scenes.length) return;
    activeSceneIndex = Math.max(0, Math.min(index, scenes.length - 1));
    scenes.forEach((scene, sceneIndex) => {
      scene.style.display = sceneIndex === activeSceneIndex ? 'block' : 'none';
    });
    scheduleSceneAdvance();
  }

  function nextScene() {
    if (!scenes.length) return;
    showScene((activeSceneIndex + 1) % scenes.length);
  }

  function previousScene() {
    if (!scenes.length) return;
    showScene((activeSceneIndex - 1 + scenes.length) % scenes.length);
  }

  // ── MRAID 3.0 lifecycle ──────────────────────────────────────────────────
  // IAB MRAID 3.0 §3.1: wait for 'ready' state before executing ad logic.
  // Non-MRAID environments: execute immediately.
  function smxBootstrap(fn) {
    if (typeof window === 'undefined' || !window.mraid) { fn(); return; }
    var mraid = window.mraid;
    if (typeof mraid.getState === 'function' && mraid.getState() !== 'loading') {
      fn();
    } else {
      mraid.addEventListener('ready', function onMraidReady() {
        try { mraid.removeEventListener('ready', onMraidReady); } catch(_) {}
        fn();
      });
    }
  }
  smxBootstrap(function() {

  document.querySelectorAll('.widget-cta[data-widget-id]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      performExit(resolveExitUrl(widgetId));
    });
  });

${EXPORT_RUNTIME_MAP_SECTION}
${EXPORT_RUNTIME_INTERACTIVE_SECTION}
${EXPORT_RUNTIME_ENVIRONMENT_SECTION}

  showScene(0);
  window.smxRuntime = {
    showScene,
    nextScene,
    previousScene,
    performExit,
    get activeSceneIndex() {
      return activeSceneIndex;
    },
  };
  }); // end smxBootstrap
})();`;
}
