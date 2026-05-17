import { isHTMLElement, parseJsonAttribute } from './runtime-dom';

type DynamicMapRuntimeOptions = {
  performExit: (url: string) => void;
};

type UserPosition = {
  latitude: number;
  longitude: number;
};

type MapPlace = {
  name?: string;
  address?: string;
  badge?: string;
  openNow?: boolean | null;
  distanceKm?: number | null;
  lat?: number | string;
  lng?: number | string;
  mapsUrl?: string;
  resolvedUrl?: string;
  wazeUrl?: string;
};

type RuntimeWindow = Window & typeof globalThis & {
  mraid?: {
    getLocation?: (
      onSuccess?: (payload: unknown) => void,
      onError?: (reason?: string) => void,
    ) => unknown;
    supports?: (feature: string) => boolean;
  };
  smxMraidState?: {
    supports?: {
      location?: boolean;
    };
  };
};

function haversineKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const arc = Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(arc), Math.sqrt(1 - arc));
}

function rankMapPlaces(root: HTMLElement, userPosition: UserPosition | null): MapPlace[] {
  const sortByDistance = root.getAttribute('data-map-sort-by-distance') === 'true';
  const places = parseJsonAttribute<MapPlace[]>(root, 'data-map-places', []);
  if (!Array.isArray(places)) return [];
  const ranked = places.map((place) => ({
    ...place,
    distanceKm: userPosition ? haversineKm(userPosition.latitude, userPosition.longitude, Number(place.lat), Number(place.lng)) : null,
  }));
  if (sortByDistance && userPosition) {
    ranked.sort((left, right) => (left.distanceKm ?? Number.MAX_SAFE_INTEGER) - (right.distanceKm ?? Number.MAX_SAFE_INTEGER));
  }
  return ranked;
}

function postUserPositionToMap(root: HTMLElement, userPosition: UserPosition | null): void {
  const frame = root.querySelector<HTMLIFrameElement>('iframe[title="Nearby locations map"]');
  if (!frame?.contentWindow || !userPosition) return;
  frame.contentWindow.postMessage({
    type: 'smx-map-center-user',
    latitude: userPosition.latitude,
    longitude: userPosition.longitude,
    label: root.getAttribute('data-map-locate-label') || 'Your location',
  }, '*');
}

function parseUserPositionPayload(payload: unknown): UserPosition | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate = payload as Record<string, any>;
  const latitude = Number(candidate.latitude ?? candidate.lat ?? candidate.coords?.latitude ?? candidate.coords?.lat);
  const longitude = Number(
    candidate.longitude
      ?? candidate.lng
      ?? candidate.lon
      ?? candidate.long
      ?? candidate.coords?.longitude
      ?? candidate.coords?.lng
      ?? candidate.coords?.lon
      ?? candidate.coords?.long,
  );
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

function requestMraidUserPosition(
  onSuccess: (position: UserPosition) => void,
  onError?: (reason?: string) => void,
): boolean {
  const runtimeWindow = window as RuntimeWindow;
  if (!runtimeWindow.mraid || typeof runtimeWindow.mraid.getLocation !== 'function') return false;
  if (typeof runtimeWindow.mraid.supports === 'function') {
    if (runtimeWindow.mraid.supports('location') === false) return false;
  } else if (runtimeWindow.smxMraidState?.supports?.location === false) {
    return false;
  }
  let settled = false;
  const succeed = (payload: unknown): void => {
    if (settled) return;
    const userPosition = parseUserPositionPayload(payload);
    if (!userPosition) {
      settled = true;
      onError?.('mraid-location-invalid');
      return;
    }
    settled = true;
    onSuccess(userPosition);
  };
  const fail = (reason?: string): void => {
    if (settled) return;
    settled = true;
    onError?.(reason || 'mraid-location-error');
  };
  try {
    const result = runtimeWindow.mraid.getLocation(succeed, fail);
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      void Promise.resolve(result).then(succeed, fail);
    } else if (result && typeof result === 'object') {
      window.setTimeout(() => succeed(result), 0);
    }
  } catch (error) {
    fail(error instanceof Error ? error.message : 'mraid-location-error');
  }
  return true;
}

function requestUserPosition(
  onSuccess: (position: UserPosition) => void,
  onError?: (reason?: string) => void,
): void {
  if (requestMraidUserPosition(onSuccess, onError)) return;
  if (!window.isSecureContext) {
    onError?.('secure-context');
    return;
  }
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError?.();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (position) => {
      onSuccess({ latitude: position.coords.latitude, longitude: position.coords.longitude });
    },
    () => {
      onError?.();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 120000 },
  );
}

function bindAutoScroll(
  container: HTMLElement | null,
  enabled: boolean,
  intervalMs: number,
  disposers: Set<() => void>,
): void {
  if (!container || !enabled || container.dataset.autoscrollBound === 'true') return;
  container.dataset.autoscrollBound = 'true';
  let direction = 1;
  let frameId = 0;
  let intervalId = 0;

  const animateStep = (targetTop: number): void => {
    const startTop = container.scrollTop;
    const distance = targetTop - startTop;
    const duration = 420;
    const startedAt = performance.now();
    const step = (now: number): void => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      container.scrollTop = startTop + distance * eased;
      if (progress < 1) frameId = window.requestAnimationFrame(step);
    };
    frameId = window.requestAnimationFrame(step);
  };

  const runStep = (): void => {
    if (!container.isConnected) return;
    const maxScroll = Math.max(0, container.scrollHeight - container.clientHeight);
    if (maxScroll <= 0) return;
    const stepSize = Math.max(48, Math.floor(container.clientHeight * 0.68));
    let targetTop = container.scrollTop + direction * stepSize;
    if (targetTop >= maxScroll - 1) {
      direction = -1;
      targetTop = maxScroll;
    } else if (targetTop <= 1) {
      direction = 1;
      targetTop = 0;
    }
    animateStep(Math.max(0, Math.min(maxScroll, targetTop)));
  };

  const stop = (): void => {
    if (frameId) window.cancelAnimationFrame(frameId);
    if (intervalId) window.clearInterval(intervalId);
    frameId = 0;
    intervalId = 0;
  };

  intervalId = window.setInterval(runStep, Math.max(900, intervalMs));
  container.addEventListener('pointerdown', stop, { once: true });
  container.addEventListener('wheel', stop, { once: true, passive: true });

  disposers.add(() => {
    stop();
    container.dataset.autoscrollBound = 'false';
  });
}

function renderMapCards(root: HTMLElement, userPosition: UserPosition | null, autoscrollDisposers: Set<() => void>): void {
  const cardsRoot = root.querySelector<HTMLElement>('[data-map-cards]');
  if (!cardsRoot) return;
  const showOpenNow = root.getAttribute('data-map-show-open-now') === 'true';
  const showDistance = root.getAttribute('data-map-show-distance') === 'true';
  const accent = root.getAttribute('data-map-accent') || '#ef4444';
  const autoscroll = root.getAttribute('data-map-autoscroll') === 'true';
  const intervalMs = Number(root.getAttribute('data-map-autoscroll-interval') || 2200);
  const ranked = rankMapPlaces(root, userPosition);
  cardsRoot.innerHTML = ranked.map((place) => {
    const meta: string[] = [];
    if (showOpenNow && place.openNow != null) meta.push(`<span data-place-open-now>${place.openNow ? 'Open now' : 'Closed'}</span>`);
    if (showDistance && place.distanceKm != null) meta.push(`<span data-place-distance>${Number(place.distanceKm).toFixed(1)} km</span>`);
    return `<div data-map-card data-place-name="${String(place.name || '')}" style="border-radius:10px;background:rgba(255,255,255,.78);border:1px solid ${accent}22;padding:7px 8px;display:grid;gap:3px;">`
      + `<div style="display:flex;align-items:center;justify-content:space-between;gap:8px;"><strong style="font-size:11px;line-height:1.1;">${String(place.name || '')}</strong><span data-place-badge style="font-size:8px;border-radius:999px;padding:2px 5px;background:${accent}22;color:#0f172a;white-space:nowrap;">${String(place.badge || (place.openNow ? 'Open now' : 'Store'))}</span></div>`
      + `<div style="font-size:9px;opacity:.78;line-height:1.15;">${String(place.address || '')}</div>`
      + `<div data-place-meta style="display:flex;gap:5px;flex-wrap:wrap;font-size:9px;">${meta.join('')}</div>`
      + '<div style="display:flex;gap:8px;">'
      + `<a href="${String(place.wazeUrl || '')}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${String(place.wazeUrl || '')}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:#fff;font-size:9px;font-weight:800;text-decoration:none;border:none;background:#08d4ff;cursor:pointer;">Waze</a>`
      + `<a href="${String(place.mapsUrl || place.resolvedUrl || '')}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${String(place.mapsUrl || place.resolvedUrl || '')}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:30px;border-radius:12px;padding:0 10px;color:#fff;font-size:9px;font-weight:800;text-decoration:none;border:none;background:#4285f4;cursor:pointer;">Maps</a>`
      + '</div>'
      + '</div>';
  }).join('');
  bindAutoScroll(cardsRoot, autoscroll, intervalMs, autoscrollDisposers);
}

function renderMapSearchBar(
  root: HTMLElement,
  userPosition: UserPosition | null,
  statusMode: 'default' | 'locating' | 'located',
  autoscrollDisposers: Set<() => void>,
): void {
  const listRoot = root.querySelector<HTMLElement>('[data-map-search-list]');
  if (!listRoot) return;
  const scrollRoot = root.querySelector<HTMLElement>('[data-map-search-scroll]');
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
  const nearest = rankMapPlaces(root, userPosition);
  const statusNode = root.querySelector<HTMLElement>('[data-map-search-status]');
  const substatusNode = root.querySelector<HTMLElement>('[data-map-search-substatus]');
  const primaryDirections = root.querySelector<HTMLElement>('[data-smx-action="map-primary-directions"]');
  const targetPlace = nearest[0] || null;

  if (statusNode) {
    statusNode.textContent = statusMode === 'locating' ? locatingText : statusMode === 'located' ? locationFoundText : infoLabel;
  }
  if (substatusNode) {
    substatusNode.innerHTML = statusMode === 'located' ? nearbyTitle : `<b>${primaryAddress}</b><br />${primaryHours}`;
  }
  if (primaryDirections) {
    primaryDirections.textContent = directionsLabel;
    primaryDirections.setAttribute('data-place-url', targetPlace ? String(targetPlace.mapsUrl || targetPlace.resolvedUrl || '') : '');
  }

  listRoot.innerHTML = nearest.map((place, index) => {
    const meta: string[] = [];
    if (place.address) meta.push(`<span>${String(place.address)}</span>`);
    if (place.badge) meta.push(`<span style="display:inline-flex;align-items:center;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:800;color:#fff;background:${accent};">${String(place.badge)}</span>`);
    if (showDistance && place.distanceKm != null) meta.push(`<span>${Number(place.distanceKm).toFixed(1)} km</span>`);
    return `<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid rgba(0,0,0,.08);border-radius:12px;background:#fff;margin-top:${index === 0 ? '0' : '6px'};">`
      + `<div style="width:20px;height:20px;border-radius:50%;background:${accent}22;color:${accent};display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:900;flex:0 0 20px;">${index + 1}</div>`
      + `<div style="flex:1;min-width:0;"><div style="font-size:12px;font-weight:800;line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${String(place.name || '')}</div>`
      + `<div style="font-size:10px;color:#666;line-height:1.2;margin-top:2px;display:flex;gap:6px;flex-wrap:wrap;">${meta.join('')}</div></div>`
      + '<div style="display:flex;gap:8px;width:116px;">'
      + `<a href="${String(place.wazeUrl || '')}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${String(place.wazeUrl || '')}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;border:none;background:#08d4ff;cursor:pointer;">Waze</a>`
      + `<a href="${String(place.mapsUrl || place.resolvedUrl || '')}" target="_blank" rel="noopener noreferrer" data-smx-action="map-place-cta" data-place-url="${String(place.mapsUrl || place.resolvedUrl || '')}" style="display:inline-flex;flex:1;align-items:center;justify-content:center;height:32px;border-radius:12px;color:#fff;font-size:10px;font-weight:800;text-decoration:none;border:none;background:#4285f4;cursor:pointer;">Maps</a>`
      + '</div></div>';
  }).join('');

  bindAutoScroll(scrollRoot, autoscroll, intervalMs, autoscrollDisposers);
}

export function mountDynamicMapRuntime({ performExit }: DynamicMapRuntimeOptions): { dispose(): void } {
  const cleanups: Array<() => void> = [];
  const autoscrollDisposers = new Set<() => void>();

  document.querySelectorAll<HTMLElement>('.widget-dynamic-map[data-widget-id]').forEach((root) => {
    const onRootClick = (event: MouseEvent): void => {
      if (!isHTMLElement(event.target)) return;
      const target = event.target.closest<HTMLElement>('[data-smx-action="map-place-cta"]');
      if (!target) return;
      event.preventDefault();
      performExit(target.getAttribute('data-place-url') || '');
    };
    root.addEventListener('click', onRootClick);
    cleanups.push(() => root.removeEventListener('click', onRootClick));

    const requestUserLocation = root.getAttribute('data-map-request-user-location') === 'true';
    const searchBarMode = root.getAttribute('data-map-render-mode') === 'search-bar';
    const lat = Number(root.getAttribute('data-map-latitude') || 0);
    const lng = Number(root.getAttribute('data-map-longitude') || 0);

    if (searchBarMode) {
      renderMapSearchBar(root, null, 'default', autoscrollDisposers);
      const openPanelButton = root.querySelector<HTMLElement>('[data-smx-action="map-open-panel"]');
      const closePanelButton = root.querySelector<HTMLElement>('[data-smx-action="map-close-panel"]');
      const locateButton = root.querySelector<HTMLElement>('[data-smx-action="map-request-location"]');
      const panel = root.querySelector<HTMLElement>('[data-map-search-panel]');
      const primaryDirections = root.querySelector<HTMLElement>('[data-smx-action="map-primary-directions"]');

      if (openPanelButton && panel) {
        const onOpen = (): void => { panel.style.display = 'block'; };
        openPanelButton.addEventListener('click', onOpen);
        cleanups.push(() => openPanelButton.removeEventListener('click', onOpen));
      }
      if (closePanelButton && panel) {
        const onClose = (): void => { panel.style.display = 'none'; };
        closePanelButton.addEventListener('click', onClose);
        cleanups.push(() => closePanelButton.removeEventListener('click', onClose));
      }
      if (primaryDirections) {
        const onDirections = (event: MouseEvent): void => {
          event.preventDefault();
          performExit(primaryDirections.getAttribute('data-place-url') || '');
        };
        primaryDirections.addEventListener('click', onDirections);
        cleanups.push(() => primaryDirections.removeEventListener('click', onDirections));
      }
      if (locateButton) {
        const onLocate = (event: MouseEvent): void => {
          event.preventDefault();
          event.stopPropagation();
          renderMapSearchBar(root, null, 'locating', autoscrollDisposers);
          requestUserPosition(
            (userPosition) => {
              renderMapSearchBar(root, userPosition, 'located', autoscrollDisposers);
              postUserPositionToMap(root, userPosition);
            },
            () => {
              renderMapSearchBar(root, null, 'default', autoscrollDisposers);
            },
          );
        };
        locateButton.addEventListener('click', onLocate);
        cleanups.push(() => locateButton.removeEventListener('click', onLocate));
      }
      return;
    }

    renderMapCards(root, null, autoscrollDisposers);
    const inlineLocateButton = root.querySelector<HTMLElement>('[data-smx-action="map-request-location-inline"]');
    if (!requestUserLocation || !Number.isFinite(lat) || !Number.isFinite(lng)) return;

    if (inlineLocateButton) {
      const onInlineLocate = (event: MouseEvent): void => {
        event.preventDefault();
        event.stopPropagation();
        requestUserPosition(
          (userPosition) => {
            renderMapCards(root, userPosition, autoscrollDisposers);
            postUserPositionToMap(root, userPosition);
          },
          () => {
            renderMapCards(root, null, autoscrollDisposers);
          },
        );
      };
      inlineLocateButton.addEventListener('click', onInlineLocate);
      cleanups.push(() => inlineLocateButton.removeEventListener('click', onInlineLocate));
      return;
    }

    requestUserPosition(
      (userPosition) => {
        renderMapCards(root, userPosition, autoscrollDisposers);
        postUserPositionToMap(root, userPosition);
      },
      () => {
        renderMapCards(root, null, autoscrollDisposers);
      },
    );
  });

  return {
    dispose() {
      cleanups.forEach((cleanup) => cleanup());
      autoscrollDisposers.forEach((dispose) => dispose());
      autoscrollDisposers.clear();
    },
  };
}
