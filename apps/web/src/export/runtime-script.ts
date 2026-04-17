import { buildExportExitConfig } from './packaging';
import type { ExportHtmlAdapter } from './html';

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
  }

  function nextScene() {
    if (!scenes.length) return;
    showScene((activeSceneIndex + 1) % scenes.length);
  }

  function previousScene() {
    if (!scenes.length) return;
    showScene((activeSceneIndex - 1 + scenes.length) % scenes.length);
  }

  document.querySelectorAll('.widget-cta[data-widget-id]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      performExit(resolveExitUrl(widgetId));
    });
  });

  function updateCarousel(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-image-carousel');
    if (!root) return;
    const slides = JSON.parse(root.getAttribute('data-carousel-slides') || '[]');
    if (!Array.isArray(slides) || !slides.length) return;
    const length = slides.length;
    const normalizedIndex = ((nextIndex % length) + length) % length;
    root.setAttribute('data-carousel-index', String(normalizedIndex));
    const activeSlide = slides[normalizedIndex];
    const image = root.querySelector('[data-carousel-image]');
    const caption = root.querySelector('[data-carousel-caption]');
    if (image && activeSlide) {
      image.setAttribute('src', activeSlide.src || '');
      image.setAttribute('alt', activeSlide.caption || '');
    }
    if (caption && activeSlide) caption.textContent = activeSlide.caption || '';
    root.querySelectorAll('[data-carousel-target]').forEach((dot) => {
      const target = Number(dot.getAttribute('data-carousel-target') || 0);
      dot.style.background = target === normalizedIndex ? 'currentColor' : 'rgba(255,255,255,.45)';
    });
  }

  document.querySelectorAll('[data-smx-action="carousel-prev"], [data-smx-action="carousel-next"], [data-smx-action="carousel-dot"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-image-carousel');
      const currentIndex = Number(root?.getAttribute('data-carousel-index') || 0);
      if (node.getAttribute('data-smx-action') === 'carousel-prev') updateCarousel(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'carousel-next') updateCarousel(widgetId, currentIndex + 1);
      if (node.getAttribute('data-smx-action') === 'carousel-dot') updateCarousel(widgetId, Number(node.getAttribute('data-carousel-target') || 0));
    });
  });

  function updateGallery(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-gallery');
    if (!root) return;
    const total = Math.max(2, Number(root.getAttribute('data-gallery-count') || 4));
    const normalizedIndex = ((nextIndex % total) + total) % total;
    root.setAttribute('data-gallery-index', String(normalizedIndex));
    const card = root.querySelector('[data-gallery-card]');
    if (card) card.textContent = String(normalizedIndex + 1) + ' / ' + String(total);
  }

  document.querySelectorAll('[data-smx-action="gallery-prev"], [data-smx-action="gallery-next"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-gallery');
      const currentIndex = Number(root?.getAttribute('data-gallery-index') || 0);
      if (node.getAttribute('data-smx-action') === 'gallery-prev') updateGallery(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'gallery-next') updateGallery(widgetId, currentIndex + 1);
    });
  });

  document.querySelectorAll('[data-smx-action="button-select"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const kind = node.getAttribute('data-button-kind') || 'primary';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-buttons');
      if (root) {
        root.querySelectorAll('[data-smx-action="button-select"]').forEach((button) => {
          const isActive = button === node;
          if (button.getAttribute('data-button-kind') === 'primary') {
            button.style.background = isActive ? '#ffffff' : '';
            button.style.color = '#111827';
          } else {
            button.style.background = isActive ? 'rgba(255,255,255,.16)' : 'transparent';
            button.style.color = '#ffffff';
          }
        });
      }
      performExit(resolveExitUrl(widgetId));
      if (kind === 'secondary' && scenes.length > 1) nextScene();
    });
  });

  document.querySelectorAll('[data-smx-action="hotspot-toggle"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-interactive-hotspot');
      const panel = root?.querySelector('[data-hotspot-panel]');
      const label = root?.querySelector('[data-hotspot-label]');
      const isOpen = panel?.style.display === 'block';
      if (panel) panel.style.display = isOpen ? 'none' : 'block';
      if (label) label.style.display = isOpen ? 'block' : 'none';
    });
  });

  document.querySelectorAll('[data-smx-action="range-update"]').forEach((node) => {
    node.addEventListener('input', () => {
      const root = node.closest('[data-widget-id]');
      const valueLabel = root?.querySelector('[data-range-value]');
      if (valueLabel) {
        const prefix = valueLabel.textContent?.split(':')[0] || 'Value';
        valueLabel.textContent = prefix + ': ' + node.value + (node.getAttribute('data-units') || '');
      }
    });
  });

  document.querySelectorAll('[data-smx-action="scratch-update"]').forEach((node) => {
    node.addEventListener('input', () => {
      const root = node.closest('[data-widget-id]');
      const cover = root?.querySelector('[data-scratch-cover]');
      if (cover) cover.style.clipPath = 'inset(0 ' + Math.max(0, 100 - Number(node.value || 0)) + '% 0 0)';
    });
  });

  function renderCountdown(root) {
    const total = Math.max(0, Number(root?.getAttribute('data-countdown-seconds') || 0));
    const startedAt = Date.now();

    function applySegments(remaining) {
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      const values = { DD: days, HH: hours, MM: minutes, SS: seconds };
      Object.entries(values).forEach(([label, value]) => {
        const node = root?.querySelector('[data-countdown-value="' + label + '"]');
        if (node) node.textContent = String(value).padStart(2, '0');
      });
    }

    function tick() {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      applySegments(remaining);
      if (remaining <= 0) return;
      window.setTimeout(tick, 1000);
    }

    applySegments(total);
    if (total > 0) window.setTimeout(tick, 1000);
  }

  document.querySelectorAll('.widget-countdown[data-widget-id]').forEach((node) => {
    renderCountdown(node);
  });

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
})();`;
}
