import { buildExportRuntimeModelFromPortable } from './runtime-model';
import { SMX_RUNTIME_BUNDLE } from './runtime-bundle.generated';
import type { ExportHtmlAdapter } from './html';
import type { PortableExportProject } from './portable';

const MAP_WIDGET_TYPES = new Set<string>(['dynamic-map', 'leaflet-map']);
const WEATHER_WIDGET_TYPES = new Set<string>(['weather-conditions']);
const SCRATCH_WIDGET_TYPES = new Set<string>(['scratch-reveal']);
const COUNTDOWN_WIDGET_TYPES = new Set<string>(['countdown']);
const INTERACTIVE_WIDGET_TYPES = new Set<string>([
  'form',
  'image-carousel',
  'interactive-gallery',
  'shoppable-sidebar',
  'meta-carousel',
  'interactive-hotspot',
  'buttons',
  'scratch-reveal',
  'speed-test',
  'range-slider',
  'slider',
]);

export function analyzeRuntimeCapabilities(document: PortableExportProject) {
  const widgets = document.scenes.flatMap((scene) => scene.widgets);
  return {
    hasMap: widgets.some((widget) => MAP_WIDGET_TYPES.has(widget.type)),
    hasInteractive: widgets.some((widget) => INTERACTIVE_WIDGET_TYPES.has(widget.type)),
    hasEnvironment: true,
    hasFontFaces: widgets.some((widget) => typeof widget.props?.fontAssetSrc === 'string' && widget.props.fontAssetSrc.trim().length > 0),
    hasHoverMotion: widgets.some((widget) => Boolean(widget.hoverMotion?.templateId) || String(widget.style?.hoverMotionPreset ?? 'none') !== 'none'),
    hasWeather: widgets.some((widget) => WEATHER_WIDGET_TYPES.has(widget.type)),
    hasScratchReveal: widgets.some((widget) => SCRATCH_WIDGET_TYPES.has(widget.type) || (widget.type === 'group' && Boolean(widget.props?.scratchEnabled))),
    hasCountdown: widgets.some((widget) => COUNTDOWN_WIDGET_TYPES.has(widget.type)),
    hasTimelineAnimations: widgets.some((widget) => (widget.timeline.keyframes?.length ?? 0) > 0),
    hasCompositorMotion: widgets.some((widget) => Boolean(widget.motion)),
  };
}

function getRuntimeProject(adapter: ExportHtmlAdapter): PortableExportProject {
  return adapter.adapter === 'playable-ad' ? adapter.playableProject : adapter.portableProject;
}

export function buildExportRuntimeScript(adapter: ExportHtmlAdapter): string {
  return compileRuntime(getRuntimeProject(adapter), adapter);
}

export function compileRuntime(document: PortableExportProject, _adapter: ExportHtmlAdapter): string {
  const runtimeModel = buildExportRuntimeModelFromPortable(document);
  return `${SMX_RUNTIME_BUNDLE}\n;window.SmxRuntime.bootSmxRuntime(${JSON.stringify(runtimeModel)});`;
}
