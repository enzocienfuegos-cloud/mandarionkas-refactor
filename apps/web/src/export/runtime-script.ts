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

  document.querySelectorAll('[data-smx-action="qr-open"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      performExit(node.getAttribute('data-qr-url') || '');
    });
  });

  function haversineKm(aLat, aLng, bLat, bLng) {
    const toRad = (value) => (value * Math.PI) / 180;
    const dLat = toRad(bLat - aLat);
    const dLng = toRad(bLng - aLng);
    const lat1 = toRad(aLat);
    const lat2 = toRad(bLat);
    const arc = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
    return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
  }

  function rankMapPlaces(root, userPosition) {
    const sortByDistance = root.getAttribute('data-map-sort-by-distance') === 'true';
    const places = JSON.parse(root.getAttribute('data-map-places') || '[]');
    if (!Array.isArray(places)) return [];
    const ranked = places.map((place) => ({
      ...place,
      distanceKm: userPosition ? haversineKm(userPosition.latitude, userPosition.longitude, Number(place.lat), Number(place.lng)) : null,
    }));
    if (sortByDistance && userPosition) ranked.sort((a, b) => (a.distanceKm ?? Number.MAX_SAFE_INTEGER) - (b.distanceKm ?? Number.MAX_SAFE_INTEGER));
    return ranked;
  }

  function postUserPositionToMap(root, userPosition) {
    const frame = root.querySelector('iframe[title="Nearby locations map"]');
    if (!frame || !frame.contentWindow || !userPosition) return;
    frame.contentWindow.postMessage({
      type: 'smx-map-center-user',
      latitude: userPosition.latitude,
      longitude: userPosition.longitude,
      label: root.getAttribute('data-map-locate-label') || 'Your location',
    }, '*');
  }

  function requestUserPosition(onSuccess, onError) {
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      if (typeof onError === 'function') onError('secure-context');
      return;
    }
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      if (typeof onError === 'function') onError();
      return;
    }
    navigator.geolocation.getCurrentPosition((position) => {
      onSuccess({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    }, () => {
      if (typeof onError === 'function') onError();
    }, { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 });
  }

  function bindAutoScroll(container, enabled, intervalMs) {
    if (!container || !enabled || container.dataset.autoscrollBound === 'true') return;
    container.dataset.autoscrollBound = 'true';
    let direction = 1;
    const tick = Math.max(16, Math.floor(intervalMs / 40));
    const timer = window.setInterval(() => {
      const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
      if (maxScroll <= 0) return;
      if (container.scrollTop >= maxScroll - 2) direction = -1;
      if (container.scrollTop <= 2) direction = 1;
      container.scrollTop = Math.max(0, Math.min(maxScroll, container.scrollTop + direction * 6));
    }, tick);
    container.addEventListener('pointerdown', () => window.clearInterval(timer), { once: true });
  }

  function renderMapCards(root, userPosition) {
    const cardsRoot = root.querySelector('[data-map-cards]');
    if (!cardsRoot) return;
    const showOpenNow = root.getAttribute('data-map-show-open-now') === 'true';
    const showDistance = root.getAttribute('data-map-show-distance') === 'true';
    const accent = root.getAttribute('data-map-accent') || '#ef4444';
    const autoscroll = root.getAttribute('data-map-autoscroll') === 'true';
    const intervalMs = Number(root.getAttribute('data-map-autoscroll-interval') || 2200);
    const ranked = rankMapPlaces(root, userPosition);
    cardsRoot.innerHTML = ranked.map((place) => {
      const meta = [];
      if (showOpenNow && place.openNow != null) meta.push('<span data-place-open-now>' + (place.openNow ? 'Open now' : 'Closed') + '</span>');
      if (showDistance && place.distanceKm != null) meta.push('<span data-place-distance>' + Number(place.distanceKm).toFixed(1) + ' km</span>');
      return '<div data-map-card data-place-name="' + String(place.name || '') + '" style="border-radius:10px;background:rgba(255,255,255,.78);border:1px solid ' + accent + '22;padding:7px 8px;display:grid;gap:3px;">'
        + '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong style="font-size:11px;line-height:1.1;">' + String(place.name || '') + '</strong><span data-place-badge style="font-size:8px;border-radius:999px;padding:2px 5px;background:' + accent + '22;color:#0f172a;white-space:nowrap;">' + String(place.badge || (place.openNow ? 'Open now' : 'Store')) + '</span></div>'
        + '<div style="font-size:9px;opacity:.78;line-height:1.15;">' + String(place.address || '') + '</div>'
        + '<div data-place-meta style="display:flex;gap:5px;flex-wrap:wrap;font-size:9px;">' + meta.join('') + '</div>'
        + '<div style="display:flex;gap:6px;flex-wrap:wrap;">'
        + '<a href="' + String(place.wazeUrl || '') + '" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="' + String(place.wazeUrl || '') + '" style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:24px;border-radius:999px;padding:0 9px;color:#fff;font-size:8px;font-weight:800;text-decoration:none;border:none;background:#08d4ff;cursor:pointer;">Waze</a>'
        + '<a href="' + String(place.mapsUrl || place.resolvedUrl || '') + '" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="' + String(place.mapsUrl || place.resolvedUrl || '') + '" style="display:inline-flex;align-items:center;justify-content:center;min-width:40px;height:24px;border-radius:999px;padding:0 9px;color:#fff;font-size:8px;font-weight:800;text-decoration:none;border:none;background:#4285f4;cursor:pointer;">Maps</a>'
        + '</div>'
        + '</div>';
    }).join('');
    bindAutoScroll(cardsRoot, autoscroll, intervalMs);
  }

  function renderMapSearchBar(root, userPosition, statusMode) {
    const listRoot = root.querySelector('[data-map-search-list]');
    if (!listRoot) return;
    const scrollRoot = root.querySelector('[data-map-search-scroll]');
    const showDistance = root.getAttribute('data-map-show-distance') === 'true';
    const accent = root.getAttribute('data-map-accent') || '#ef4444';
    const autoscroll = root.getAttribute('data-map-autoscroll') === 'true';
    const intervalMs = Number(root.getAttribute('data-map-autoscroll-interval') || 2200);
    const directionsLabel = root.getAttribute('data-map-directions-label') || root.getAttribute('data-map-default-cta-label') || 'Open in Maps';
    const infoLabel = root.getAttribute('data-map-info-label') || 'Nearby locations';
    const primaryAddress = root.getAttribute('data-map-primary-address') || '';
    const primaryHours = root.getAttribute('data-map-primary-hours') || '';
    const nearbyTitle = root.getAttribute('data-map-nearby-title') || 'Nearby';
    const locatingText = root.getAttribute('data-map-locating-text') || 'Locating';
    const locationFoundText = root.getAttribute('data-map-location-found-text') || 'Location found';
    const ranked = rankMapPlaces(root, userPosition);
    const nearest = ranked;
    const statusNode = root.querySelector('[data-map-search-status]');
    const substatusNode = root.querySelector('[data-map-search-substatus]');
    const primaryDirections = root.querySelector('[data-smx-action="map-primary-directions"]');
    const targetPlace = nearest[0] || null;
    if (statusNode) statusNode.textContent = statusMode === 'locating' ? locatingText : statusMode === 'located' ? locationFoundText : infoLabel;
    if (substatusNode) {
      substatusNode.innerHTML = statusMode === 'located'
        ? nearbyTitle
        : '<b>' + primaryAddress + '</b><br />' + primaryHours;
    }
    if (primaryDirections) {
      primaryDirections.textContent = directionsLabel;
      primaryDirections.setAttribute('data-place-url', targetPlace ? String(targetPlace.mapsUrl || targetPlace.resolvedUrl || '') : '');
    }
    listRoot.innerHTML = nearest.map((place, index) => {
      const meta = [];
      if (place.address) meta.push('<span>' + String(place.address) + '</span>');
      if (place.badge) meta.push('<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;color:#fff;background:' + accent + ';">' + String(place.badge) + '</span>');
      if (showDistance && place.distanceKm != null) meta.push('<span>' + Number(place.distanceKm).toFixed(1) + ' km</span>');
      return '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff;margin-top:' + (index === 0 ? '0' : '6px') + ';">'
        + '<div style="width:20px;height:20px;border-radius:50%;background:' + accent + '22;color:' + accent + ';display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:0 0 20px;">' + String(index + 1) + '</div>'
        + '<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + String(place.name || '') + '</div>'
        + '<div style="font-size:10px;color:#666;line-height:1.2;margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;">' + meta.join('') + '</div></div>'
        + '<div style="display:flex;gap:6px;">'
        + '<a href="' + String(place.wazeUrl || '') + '" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="' + String(place.wazeUrl || '') + '" style="display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:28px;border-radius:999px;padding:0 10px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;border:none;background:#08d4ff;cursor:pointer;">Waze</a>'
        + '<a href="' + String(place.mapsUrl || place.resolvedUrl || '') + '" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="' + String(place.mapsUrl || place.resolvedUrl || '') + '" style="display:inline-flex;align-items:center;justify-content:center;min-width:46px;height:28px;border-radius:999px;padding:0 10px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;border:none;background:#4285f4;cursor:pointer;">Maps</a>'
        + '</div></div>';
    }).join('');
    bindAutoScroll(scrollRoot, autoscroll, intervalMs);
  }

  document.querySelectorAll('.widget-dynamic-map[data-widget-id]').forEach((root) => {
    const requestUserLocation = root.getAttribute('data-map-request-user-location') === 'true';
    const searchBarMode = root.getAttribute('data-map-render-mode') === 'search-bar';
    const lat = Number(root.getAttribute('data-map-latitude') || 0);
    const lng = Number(root.getAttribute('data-map-longitude') || 0);
    root.addEventListener('click', (event) => {
      const target = event.target && event.target.closest ? event.target.closest('[data-smx-action="map-place-cta"]') : null;
      if (!target) return;
      event.preventDefault();
      performExit(target.getAttribute('data-place-url') || '');
    });
    if (searchBarMode) {
      renderMapSearchBar(root, null, 'default');
      const openPanelButton = root.querySelector('[data-smx-action="map-open-panel"]');
      const closePanelButton = root.querySelector('[data-smx-action="map-close-panel"]');
      const locateButton = root.querySelector('[data-smx-action="map-request-location"]');
      const panel = root.querySelector('[data-map-search-panel]');
      const primaryDirections = root.querySelector('[data-smx-action="map-primary-directions"]');
      if (openPanelButton && panel) openPanelButton.addEventListener('click', () => { panel.style.display = 'block'; });
      if (closePanelButton && panel) closePanelButton.addEventListener('click', () => { panel.style.display = 'none'; });
      if (primaryDirections) primaryDirections.addEventListener('click', (event) => {
        event.preventDefault();
        performExit(primaryDirections.getAttribute('data-place-url') || '');
      });
      if (locateButton && typeof navigator !== 'undefined' && navigator.geolocation) {
        locateButton.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          renderMapSearchBar(root, null, 'locating');
          requestUserPosition((userPosition) => {
            renderMapSearchBar(root, userPosition, 'located');
            postUserPositionToMap(root, userPosition);
          }, (reason) => {
            if (reason === 'secure-context') renderMapSearchBar(root, null, 'default');
            renderMapSearchBar(root, null, 'default');
          });
        });
      }
      return;
    }
    renderMapCards(root, null);
    const inlineLocateButton = root.querySelector('[data-smx-action="map-request-location-inline"]');
    if (!requestUserLocation || typeof navigator === 'undefined' || !navigator.geolocation || !Number.isFinite(lat) || !Number.isFinite(lng)) return;
    if (inlineLocateButton) {
      inlineLocateButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        requestUserPosition((userPosition) => {
          renderMapCards(root, userPosition);
          postUserPositionToMap(root, userPosition);
        }, () => {
          renderMapCards(root, null);
        });
      });
      return;
    }
    requestUserPosition((userPosition) => {
      renderMapCards(root, userPosition);
      postUserPositionToMap(root, userPosition);
    }, () => {
      renderMapCards(root, null);
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
    const slides = JSON.parse(root.getAttribute('data-gallery-slides') || '[]');
    const total = Math.max(1, Array.isArray(slides) && slides.length ? slides.length : Number(root.getAttribute('data-gallery-count') || 4));
    const normalizedIndex = ((nextIndex % total) + total) % total;
    root.setAttribute('data-gallery-index', String(normalizedIndex));
    const card = root.querySelector('[data-gallery-card]');
    const image = root.querySelector('[data-gallery-image]');
    const caption = root.querySelector('[data-gallery-caption]');
    const count = root.querySelector('[data-gallery-count]');
    const activeSlide = Array.isArray(slides) ? slides[normalizedIndex] : null;
    if (image && activeSlide) {
      image.setAttribute('src', activeSlide.src || '');
      image.setAttribute('alt', activeSlide.caption || '');
    }
    if (caption && activeSlide) caption.textContent = activeSlide.caption || ('Image ' + String(normalizedIndex + 1));
    if (count) count.textContent = String(normalizedIndex + 1) + ' / ' + String(total);
    if (!image && card) card.textContent = String(normalizedIndex + 1) + ' / ' + String(total);
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

  function updateShoppable(widgetId, nextIndex) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-shoppable-sidebar');
    if (!root) return;
    const products = JSON.parse(root.getAttribute('data-shoppable-products') || '[]');
    if (!Array.isArray(products) || !products.length) return;
    const orientation = root.getAttribute('data-shoppable-layout') || 'horizontal';
    const cardWidth = Number(root.getAttribute('data-shoppable-card-width') || 124);
    const cardHeight = Number(root.getAttribute('data-shoppable-card-height') || 164);
    const normalizedIndex = ((nextIndex % products.length) + products.length) % products.length;
    root.setAttribute('data-shoppable-index', String(normalizedIndex));
    const track = root.querySelector('[data-shoppable-track]');
    if (!track) return;
    const gap = 12;
    track.style.transform = orientation === 'vertical'
      ? 'translateY(-' + String(normalizedIndex * (cardHeight + gap)) + 'px)'
      : 'translateX(-' + String(normalizedIndex * (cardWidth + gap)) + 'px)';
  }

  document.querySelectorAll('[data-smx-action="shoppable-prev"], [data-smx-action="shoppable-next"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-shoppable-sidebar');
      const currentIndex = Number(root?.getAttribute('data-shoppable-index') || 0);
      if (node.getAttribute('data-smx-action') === 'shoppable-prev') updateShoppable(widgetId, currentIndex - 1);
      if (node.getAttribute('data-smx-action') === 'shoppable-next') updateShoppable(widgetId, currentIndex + 1);
    });
  });

  document.querySelectorAll('[data-smx-action="shoppable-cta"]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      performExit(node.getAttribute('data-product-url') || '');
    });
  });

  document.querySelectorAll('.widget-shoppable-sidebar[data-widget-id]').forEach((root) => {
    const products = JSON.parse(root.getAttribute('data-shoppable-products') || '[]');
    const autoscroll = root.getAttribute('data-shoppable-autoscroll') === 'true';
    const interval = Math.max(1000, Number(root.getAttribute('data-shoppable-interval') || 2600));
    if (!Array.isArray(products) || products.length <= 1 || !autoscroll) return;
    window.setInterval(() => {
      const widgetId = root.getAttribute('data-widget-id') || '';
      const currentIndex = Number(root.getAttribute('data-shoppable-index') || 0);
      updateShoppable(widgetId, currentIndex + 1);
    }, interval);
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

  function runSpeedTest(widgetId) {
    const root = document.querySelector('[data-widget-id="' + widgetId + '"].widget-speed-test');
    if (!root || root.getAttribute('data-speed-running') === 'true') return;
    const min = Number(root.getAttribute('data-speed-min') || 10);
    const max = Number(root.getAttribute('data-speed-max') || 100);
    const fixedValue = Number(root.getAttribute('data-speed-current') || 64);
    const duration = Math.max(300, Number(root.getAttribute('data-speed-duration') || 1800));
    const mode = root.getAttribute('data-speed-result-mode') || 'random';
    const units = root.getAttribute('data-speed-units') || 'Mbps';
    const fastThreshold = Number(root.getAttribute('data-speed-fast-threshold') || 70);
    const fastMessage = root.getAttribute('data-speed-fast-message') || 'WOW, very fast network';
    const slowMessage = root.getAttribute('data-speed-slow-message') || 'Slow connection';
    const button = root.querySelector('[data-smx-action="speed-test-start"]');
    const value = root.querySelector('[data-speed-value]');
    const bar = root.querySelector('[data-speed-bar]');
    const status = root.querySelector('[data-speed-status]');
    const target = mode === 'fixed'
      ? Math.max(min, Math.min(max, fixedValue))
      : Math.max(min, Math.min(max, Math.round(min + Math.random() * Math.max(1, max - min))));
    const startedAt = performance.now();

    root.setAttribute('data-speed-running', 'true');
    if (button) button.textContent = 'Testing…';
    if (bar) bar.style.width = '0%';
    if (value) value.innerHTML = String(min) + '<span style="font-size:13px;opacity:.8;"> ' + units + '</span>';

    function tick(now) {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(min + (target - min) * eased);
      const pct = Math.max(0, Math.min(100, (current / Math.max(1, max)) * 100));
      const isFast = current >= fastThreshold;
      if (bar) bar.style.width = pct + '%';
      if (bar) bar.style.background = isFast ? '#22c55e' : '#ef4444';
      if (value) value.innerHTML = String(current) + '<span style="font-size:13px;opacity:.8;"> ' + units + '</span>';
      if (status) {
        status.textContent = isFast ? fastMessage : slowMessage;
        status.style.color = isFast ? '#22c55e' : '#ef4444';
      }
      if (progress < 1) {
        window.requestAnimationFrame(tick);
        return;
      }
      root.setAttribute('data-speed-running', 'false');
      root.setAttribute('data-speed-current', String(target));
      if (button) button.textContent = button.getAttribute('data-original-label') || button.textContent || 'Start test';
    }

    window.requestAnimationFrame(tick);
  }

  document.querySelectorAll('[data-smx-action="speed-test-start"]').forEach((node) => {
    if (!node.getAttribute('data-original-label')) {
      node.setAttribute('data-original-label', node.textContent || 'Start test');
    }
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      runSpeedTest(widgetId);
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

  function resolveWeatherCondition(code) {
    if (code === 0) return 'Clear';
    if (code === 1 || code === 2) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Fog';
    if (code === 51 || code === 53 || code === 55 || code === 56 || code === 57) return 'Drizzle';
    if (code === 61 || code === 63 || code === 65 || code === 66 || code === 67 || code === 80 || code === 81 || code === 82) return 'Rain';
    if (code === 71 || code === 73 || code === 75 || code === 77 || code === 85 || code === 86) return 'Snow';
    if (code === 95 || code === 96 || code === 99) return 'Storm';
    return 'Weather';
  }

  function resolveWeatherIcon(condition, isDay) {
    const normalized = String(condition || '').toLowerCase();
    if (normalized.includes('storm')) return '⛈️';
    if (normalized.includes('snow')) return '❄️';
    if (normalized.includes('rain') || normalized.includes('drizzle')) return '🌧️';
    if (normalized.includes('fog')) return '🌫️';
    if (normalized.includes('cloud')) return '☁️';
    return isDay ? '☀️' : '🌙';
  }

  function buildWeatherCacheKey(provider, latitude, longitude) {
    return 'smx-weather:' + provider + ':' + Number(latitude).toFixed(4) + ':' + Number(longitude).toFixed(4);
  }

  function readWeatherCache(key, cacheTtlMs) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) return null;
      const snapshot = JSON.parse(raw);
      const age = Date.now() - Date.parse(snapshot.fetchedAt);
      if (!Number.isFinite(age) || age > cacheTtlMs) return null;
      return snapshot;
    } catch {
      return null;
    }
  }

  function writeWeatherCache(key, snapshot) {
    try {
      window.localStorage.setItem(key, JSON.stringify(snapshot));
    } catch {
      // ignore cache write failures
    }
  }

  function applyWeatherSnapshot(root, snapshot, statusText) {
    const temperatureNode = root.querySelector('[data-weather-temperature-display]');
    const locationNode = root.querySelector('[data-weather-location-display]');
    const conditionNode = root.querySelector('[data-weather-condition-display]');
    const iconNode = root.querySelector('[data-weather-icon]');
    const statusNode = root.querySelector('[data-weather-status]');
    if (temperatureNode) temperatureNode.textContent = String(snapshot.temperature) + '°';
    if (locationNode) locationNode.textContent = snapshot.location || '';
    if (conditionNode) conditionNode.textContent = snapshot.condition || '';
    if (iconNode) iconNode.textContent = resolveWeatherIcon(snapshot.condition, Boolean(snapshot.isDay));
    if (statusNode) statusNode.textContent = statusText;
  }

  async function initWeatherWidget(root) {
    const live = root.getAttribute('data-weather-live') === 'true';
    const provider = root.getAttribute('data-weather-provider') || 'open-meteo';
    const fetchPolicy = root.getAttribute('data-weather-fetch-policy') || 'cache-first';
    const cacheTtlMs = Math.max(1000, Number(root.getAttribute('data-weather-cache-ttl') || 300000));
    const latitude = Number(root.getAttribute('data-weather-latitude') || 0);
    const longitude = Number(root.getAttribute('data-weather-longitude') || 0);
    const location = root.getAttribute('data-weather-location') || 'Location';
    const fallbackSnapshot = {
      location,
      temperature: Number(root.getAttribute('data-weather-temperature') || 0),
      condition: root.getAttribute('data-weather-condition') || 'Weather',
      conditionCode: -1,
      isDay: true,
      fetchedAt: new Date().toISOString(),
    };

    applyWeatherSnapshot(root, fallbackSnapshot, live && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview');

    if (!live || provider !== 'open-meteo' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const cacheKey = buildWeatherCacheKey(provider, latitude, longitude);
    const cached = readWeatherCache(cacheKey, cacheTtlMs);
    if (fetchPolicy === 'cache-only') {
      if (cached) applyWeatherSnapshot(root, cached, 'Live weather');
      return;
    }
    if (fetchPolicy === 'cache-first' && cached) {
      applyWeatherSnapshot(root, cached, 'Live weather');
      return;
    }

    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.searchParams.set('latitude', String(latitude));
      url.searchParams.set('longitude', String(longitude));
      url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
      url.searchParams.set('timezone', 'auto');
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('weather-fetch-failed');
      const payload = await response.json();
      const current = payload && payload.current ? payload.current : null;
      if (!current) throw new Error('weather-current-missing');
      const snapshot = {
        location,
        temperature: Math.round(Number(current.temperature_2m || fallbackSnapshot.temperature)),
        conditionCode: Number(current.weather_code || 0),
        condition: resolveWeatherCondition(Number(current.weather_code || 0)),
        isDay: Number(current.is_day || 1) === 1,
        fetchedAt: new Date().toISOString(),
      };
      writeWeatherCache(cacheKey, snapshot);
      applyWeatherSnapshot(root, snapshot, 'Live weather');
    } catch {
      if (cached) {
        applyWeatherSnapshot(root, cached, 'Live weather');
        return;
      }
      applyWeatherSnapshot(root, fallbackSnapshot, 'Static fallback');
    }
  }

  document.querySelectorAll('.widget-weather-conditions[data-widget-id]').forEach((root) => {
    void initWeatherWidget(root);
  });

  function paintScratchCover(canvas, coverImage, coverBlur, accent, onReady) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    function fallback() {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#d1d5db';
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = accent + '22';
      ctx.fillRect(0, 0, width, height);
      if (onReady) onReady();
    }

    if (!coverImage) {
      fallback();
      return;
    }

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.filter = 'blur(' + Math.max(0, Number(coverBlur || 0)) + 'px)';
      ctx.drawImage(image, 0, 0, width, height);
      ctx.filter = 'none';
      ctx.fillStyle = 'rgba(17,24,39,0.25)';
      ctx.fillRect(0, 0, width, height);
      if (onReady) onReady();
    };
    image.onerror = fallback;
    image.src = coverImage;
  }

  function eraseScratch(canvas, x, y, radius) {
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function initScratchReveal(root) {
    const canvas = root?.querySelector('[data-scratch-canvas]');
    if (!canvas) return;
    const accent = root.getAttribute('data-scratch-accent') || '#f97316';
    const coverImage = root.getAttribute('data-scratch-cover-image') || '';
    const coverBlur = Number(root.getAttribute('data-scratch-cover-blur') || 0);
    const scratchRadius = Math.max(8, Number(root.getAttribute('data-scratch-radius') || 22));
    const state = { pointerActive: false };

    function syncCanvasSize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width));
      canvas.height = Math.max(1, Math.round(rect.height));
      paintScratchCover(canvas, coverImage, coverBlur, accent, () => {
        canvas.style.opacity = '1';
      });
    }

    function scratchAtEvent(event) {
      const rect = canvas.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width;
      const y = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height;
      eraseScratch(canvas, x, y, scratchRadius);
    }

    canvas.style.opacity = '0';
    syncCanvasSize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(() => syncCanvasSize());
      observer.observe(canvas);
    } else {
      window.addEventListener('resize', syncCanvasSize);
    }

    canvas.addEventListener('pointerdown', (event) => {
      state.pointerActive = true;
      scratchAtEvent(event);
    });
    canvas.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'mouse') {
        scratchAtEvent(event);
        return;
      }
      if (!state.pointerActive) return;
      scratchAtEvent(event);
    });
    canvas.addEventListener('pointerenter', (event) => {
      if (event.pointerType === 'mouse') scratchAtEvent(event);
    });
    canvas.addEventListener('pointerup', () => {
      state.pointerActive = false;
    });
    canvas.addEventListener('pointercancel', () => {
      state.pointerActive = false;
    });
  }

  document.querySelectorAll('.scratch-reveal-shell[data-scratch-widget-id]').forEach((node) => {
    initScratchReveal(node);
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
