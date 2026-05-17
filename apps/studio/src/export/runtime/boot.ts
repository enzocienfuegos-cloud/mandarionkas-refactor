import type { ExportExitConfig } from '../packaging';
import { mountDynamicMapRuntime } from './dynamic-map-runtime';
import { mountInteractiveRuntime } from './interactive-runtime';
import { createSceneManager } from './scene-manager';
import { RuntimeAnimationEngine } from './runtime-engine';
import { mountScratchReveal } from './scratch';
import { mountWidgetMotions } from './widget-mounter';
import type { ExportRuntimeModel } from './runtime-model';

type RuntimeGlobals = Window & typeof globalThis & {
  SmxRuntime?: {
    bootSmxRuntime?: typeof bootSmxRuntime;
  };
  smxInitCompositorMotion?: () => void;
  smxRuntime?: Record<string, unknown>;
  clickTag?: string;
  mraid?: {
    open?: (url: string) => void;
  };
  smxPlayableExit?: (url: string) => void;
  smxExit?: (url: string) => void;
};

function parseRuntimeJson<T>(nodeId: string, fallback: T, label: string): T {
  const node = document.getElementById(nodeId);
  if (!node) return fallback;
  try {
    return JSON.parse(node.textContent || '{}') as T;
  } catch (error) {
    console.error(`[SMX runtime] invalid ${label}`, error);
    return fallback;
  }
}

function inferRuntimeFontFormat(src: string): string {
  const normalized = String(src || '').toLowerCase();
  if (normalized.includes('.woff2')) return 'woff2';
  if (normalized.includes('.woff')) return 'woff';
  if (normalized.includes('.ttf')) return 'truetype';
  if (normalized.includes('.otf')) return 'opentype';
  return '';
}

function ensureRuntimeFontFaces(runtimeModel: ExportRuntimeModel): void {
  if (!Array.isArray(runtimeModel.fontFaces) || !runtimeModel.fontFaces.length) return;
  const styleId = 'smx-runtime-font-faces';
  if (document.getElementById(styleId)) return;
  const style = document.createElement('style');
  style.id = styleId;
  style.textContent = runtimeModel.fontFaces.map((fontFace) => {
    if (!fontFace?.family || !fontFace.src) return '';
    const format = inferRuntimeFontFormat(fontFace.src);
    return `@font-face{font-family:"${String(fontFace.family).replace(/"/g, '\\"')}";src:url("${String(fontFace.src).replace(/"/g, '\\"')}")${format ? ` format("${format}")` : ''};font-display:swap;font-style:normal;font-weight:400;}`;
  }).join('\n');
  document.head.appendChild(style);
}

function buildFallbackExitConfig(): ExportExitConfig {
  return {
    adapter: 'generic-html5',
    strategy: 'window-open',
    primaryUrl: null,
    urls: [],
  };
}

function createExitController(runtimeModel: ExportRuntimeModel, exitConfig: ExportExitConfig) {
  const runtimeWindow = window as RuntimeGlobals;

  const resolveExitUrl = (widgetId: string): string => {
    const interaction = runtimeModel.interactions.find(
      (item) => item.widgetId === widgetId && item.actionType === 'open-url' && item.url,
    );
    return interaction?.url || exitConfig.primaryUrl || '';
  };

  const performExit = (url: string): void => {
    const target = url || exitConfig.primaryUrl || '';
    if (!target) return;
    if (exitConfig.strategy === 'playable-bridge' && typeof runtimeWindow.smxPlayableExit === 'function') {
      runtimeWindow.smxPlayableExit(target);
      return;
    }
    if (exitConfig.strategy === 'clickTag') {
      runtimeWindow.clickTag = runtimeWindow.clickTag || target;
      if (typeof runtimeWindow.smxExit === 'function') {
        runtimeWindow.smxExit(target);
        return;
      }
    }
    if (exitConfig.strategy === 'mraid-open' && runtimeWindow.mraid && typeof runtimeWindow.mraid.open === 'function') {
      runtimeWindow.mraid.open(target);
      return;
    }
    if (typeof runtimeWindow.open === 'function') {
      runtimeWindow.open(target, '_blank');
    }
  };

  return { resolveExitUrl, performExit };
}

function mountCountdownWidgets(): void {
  document.querySelectorAll<HTMLElement>('.widget-countdown[data-widget-id]').forEach((root) => {
    const total = Math.max(0, Number(root.getAttribute('data-countdown-seconds') || 0));
    const startedAt = Date.now();
    const applySegments = (remaining: number): void => {
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const minutes = Math.floor((remaining % 3600) / 60);
      const seconds = remaining % 60;
      const values = { DD: days, HH: hours, MM: minutes, SS: seconds };
      Object.entries(values).forEach(([label, value]) => {
        const node = root.querySelector<HTMLElement>(`[data-countdown-value="${label}"]`);
        if (node) node.textContent = String(value).padStart(2, '0');
      });
    };
    const tick = (): void => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const remaining = Math.max(0, total - elapsed);
      applySegments(remaining);
      if (remaining <= 0) return;
      window.setTimeout(tick, 1000);
    };
    applySegments(total);
    if (total > 0) window.setTimeout(tick, 1000);
  });
}

function mountWeatherWidgets(): void {
  const resolveWeatherCondition = (code: number): string => {
    if (code === 0) return 'Clear';
    if (code === 1 || code === 2) return 'Partly cloudy';
    if (code === 3) return 'Cloudy';
    if (code === 45 || code === 48) return 'Fog';
    if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
    if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
    if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
    if ([95, 96, 99].includes(code)) return 'Storm';
    return 'Weather';
  };

  const resolveWeatherIcon = (condition: string, isDay: boolean): string => {
    const normalized = String(condition || '').toLowerCase();
    if (normalized.includes('storm')) return '⛈️';
    if (normalized.includes('snow')) return '❄️';
    if (normalized.includes('rain') || normalized.includes('drizzle')) return '🌧️';
    if (normalized.includes('fog')) return '🌫️';
    if (normalized.includes('cloud')) return '☁️';
    return isDay ? '☀️' : '🌙';
  };

  const applyWeatherSnapshot = (
    root: HTMLElement,
    snapshot: { location: string; temperature: number; condition: string; isDay: boolean },
    statusText: string,
  ): void => {
    const temperatureNode = root.querySelector<HTMLElement>('[data-weather-temperature-display]');
    const locationNode = root.querySelector<HTMLElement>('[data-weather-location-display]');
    const conditionNode = root.querySelector<HTMLElement>('[data-weather-condition-display]');
    const iconNode = root.querySelector<HTMLElement>('[data-weather-icon]');
    const statusNode = root.querySelector<HTMLElement>('[data-weather-status]');
    if (temperatureNode) temperatureNode.textContent = `${snapshot.temperature}°`;
    if (locationNode) locationNode.textContent = snapshot.location || '';
    if (conditionNode) conditionNode.textContent = snapshot.condition || '';
    if (iconNode) iconNode.textContent = resolveWeatherIcon(snapshot.condition, snapshot.isDay);
    if (statusNode) statusNode.textContent = statusText;
  };

  document.querySelectorAll<HTMLElement>('.widget-weather-conditions[data-widget-id]').forEach((root) => {
    const live = root.getAttribute('data-weather-live') === 'true';
    const provider = root.getAttribute('data-weather-provider') || 'open-meteo';
    const latitude = Number(root.getAttribute('data-weather-latitude') || 0);
    const longitude = Number(root.getAttribute('data-weather-longitude') || 0);
    const location = root.getAttribute('data-weather-location') || 'Location';
    const fallbackSnapshot = {
      location,
      temperature: Number(root.getAttribute('data-weather-temperature') || 0),
      condition: root.getAttribute('data-weather-condition') || 'Weather',
      isDay: true,
    };

    applyWeatherSnapshot(root, fallbackSnapshot, live && provider === 'open-meteo' ? 'Fetching live weather' : 'Static preview');
    if (!live || provider !== 'open-meteo' || !Number.isFinite(latitude) || !Number.isFinite(longitude)) return;

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.searchParams.set('latitude', String(latitude));
    url.searchParams.set('longitude', String(longitude));
    url.searchParams.set('current', 'temperature_2m,weather_code,is_day');
    url.searchParams.set('timezone', 'auto');

    fetch(url.toString())
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('weather-fetch-failed')))
      .then((payload) => {
        const current = payload?.current;
        if (!current) return;
        applyWeatherSnapshot(root, {
          location,
          temperature: Math.round(Number(current.temperature_2m || fallbackSnapshot.temperature)),
          condition: resolveWeatherCondition(Number(current.weather_code || 0)),
          isDay: Number(current.is_day || 1) === 1,
        }, 'Live weather');
      })
      .catch(() => {
        applyWeatherSnapshot(root, fallbackSnapshot, 'Static fallback');
      });
  });
}

export function bootSmxRuntime(runtimeModel: ExportRuntimeModel): void {
  const runtimeWindow = window as RuntimeGlobals;
  const exitConfig = parseRuntimeJson<ExportExitConfig>('smx-exit-config', buildFallbackExitConfig(), 'exit config');
  ensureRuntimeFontFaces(runtimeModel);

  const engine = new RuntimeAnimationEngine();
  const sceneManager = createSceneManager({ runtimeModel, engine });
  const { resolveExitUrl, performExit } = createExitController(runtimeModel, exitConfig);

  document.querySelectorAll<HTMLElement>('.widget-cta[data-widget-id]').forEach((node) => {
    node.addEventListener('click', (event) => {
      event.preventDefault();
      const widgetId = node.getAttribute('data-widget-id') || '';
      performExit(resolveExitUrl(widgetId));
    });
  });

  const widgetMount = mountWidgetMotions(runtimeModel, engine, sceneManager);
  const scratchMount = mountScratchReveal(engine, runtimeModel);
  const interactiveMount = mountInteractiveRuntime({ runtimeModel, performExit, resolveExitUrl, sceneManager });
  const dynamicMapMount = mountDynamicMapRuntime({ performExit });
  mountCountdownWidgets();
  mountWeatherWidgets();

  runtimeWindow.SmxRuntime = runtimeWindow.SmxRuntime ?? {};
  runtimeWindow.SmxRuntime.bootSmxRuntime = bootSmxRuntime;
  runtimeWindow.smxInitCompositorMotion = () => {
    sceneManager.showScene(sceneManager.getActiveSceneIndex());
  };
  runtimeWindow.smxRuntime = runtimeWindow.smxRuntime ?? {};
  Object.assign(runtimeWindow.smxRuntime, {
    showScene: sceneManager.showScene,
    nextScene: sceneManager.nextScene,
    previousScene: sceneManager.previousScene,
    performExit,
    dispose() {
      dynamicMapMount.dispose();
      interactiveMount.dispose();
      widgetMount.dispose();
      scratchMount.dispose();
      sceneManager.dispose();
      engine.dispose();
    },
    get activeSceneIndex() {
      return sceneManager.getActiveSceneIndex();
    },
  });

  sceneManager.showScene(0);
}
