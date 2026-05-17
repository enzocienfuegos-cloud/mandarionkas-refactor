import { buildExportExitConfig } from './packaging';
import type { ExportHtmlAdapter } from './html';
import type { PortableExportProject, PortableExportWidget } from './portable';
import {
  EXPORT_RUNTIME_COMPOSITOR_MOTION_SECTION,
  EXPORT_RUNTIME_COUNTDOWN_SECTION,
  EXPORT_RUNTIME_ENVIRONMENT_SECTION,
  EXPORT_RUNTIME_FONTS_SECTION,
  EXPORT_RUNTIME_INTERACTIVE_SECTION,
  EXPORT_RUNTIME_MAP_SECTION,
  EXPORT_RUNTIME_MOTION_SECTION,
  EXPORT_RUNTIME_SCRATCH_SECTION,
  EXPORT_RUNTIME_TIMELINE_SECTION,
  EXPORT_RUNTIME_WEATHER_SECTION,
} from './runtime-script-sections';
import { buildCompositorMotionSpec } from '../motion/compositor-motion';

type RuntimeCapabilities = {
  hasMap: boolean;
  hasInteractive: boolean;
  hasEnvironment: true;
  hasFontFaces: boolean;
  hasHoverMotion: boolean;
  hasWeather: boolean;
  hasScratchReveal: boolean;
  hasCountdown: boolean;
  hasTimelineAnimations: boolean;
  hasCompositorMotion: boolean;
};

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
const INTERACTIVE_ACTION_TYPES = new Set<string>([
  'open-url',
  'show-widget',
  'hide-widget',
  'toggle-widget',
  'go-to-scene',
  'play-video',
  'pause-video',
  'seek-video',
  'mute-video',
  'unmute-video',
  'show-overlay',
  'hide-overlay',
  'emit-analytics-event',
]);

function sceneHasInteractiveWidget(widget: PortableExportWidget): boolean {
  return INTERACTIVE_WIDGET_TYPES.has(widget.type);
}

export function analyzeRuntimeCapabilities(document: PortableExportProject): RuntimeCapabilities {
  const widgets = document.scenes.flatMap((scene) => scene.widgets);
  const hasMap = widgets.some((widget) => MAP_WIDGET_TYPES.has(widget.type));
  const hasInteractiveWidget = widgets.some((widget) => sceneHasInteractiveWidget(widget));
  const hasInteractiveAction = widgets.some((widget) =>
    widget.interactions.some((interaction) => !interaction.disabled && INTERACTIVE_ACTION_TYPES.has(interaction.type)),
  ) || document.interactions.some((interaction) => !interaction.disabled && INTERACTIVE_ACTION_TYPES.has(interaction.type));
  const hasWeather = widgets.some((widget) => WEATHER_WIDGET_TYPES.has(widget.type));
  const hasScratchReveal = widgets.some((widget) => SCRATCH_WIDGET_TYPES.has(widget.type) || (widget.type === 'group' && Boolean(widget.props?.scratchEnabled)));
  const hasCountdown = widgets.some((widget) => COUNTDOWN_WIDGET_TYPES.has(widget.type));
  const hasTimelineAnimations = widgets.some((widget) => (widget.timeline.keyframes?.length ?? 0) > 0 && !buildCompositorMotionSpec(widget.motion));
  const hasCompositorMotion = widgets.some((widget) => Boolean(buildCompositorMotionSpec(widget.motion)));
  const hasFontFaces = widgets.some((widget) => typeof widget.props?.fontAssetSrc === 'string' && widget.props.fontAssetSrc.trim().length > 0);
  const hasHoverMotion = widgets.some((widget) => {
    if (widget.hoverMotion?.templateId) return true;
    const preset = String(widget.style?.hoverMotionPreset ?? 'none');
    return preset !== 'none' && preset.length > 0;
  });

  return {
    hasMap,
    hasInteractive: hasInteractiveWidget || hasInteractiveAction,
    hasEnvironment: true,
    hasFontFaces,
    hasHoverMotion,
    hasWeather,
    hasScratchReveal,
    hasCountdown,
    hasTimelineAnimations,
    hasCompositorMotion,
  };
}

export function compileRuntime(document: PortableExportProject, adapter: ExportHtmlAdapter): string {
  const capabilities = analyzeRuntimeCapabilities(document);
  const sections: string[] = [];
  if (capabilities.hasMap) sections.push(EXPORT_RUNTIME_MAP_SECTION);
  if (capabilities.hasInteractive) sections.push(EXPORT_RUNTIME_INTERACTIVE_SECTION);
  if (capabilities.hasEnvironment) sections.push(EXPORT_RUNTIME_ENVIRONMENT_SECTION);
  if (capabilities.hasFontFaces) sections.push(EXPORT_RUNTIME_FONTS_SECTION);
  if (capabilities.hasHoverMotion) sections.push(EXPORT_RUNTIME_MOTION_SECTION);
  if (capabilities.hasWeather) sections.push(EXPORT_RUNTIME_WEATHER_SECTION);
  if (capabilities.hasScratchReveal) sections.push(EXPORT_RUNTIME_SCRATCH_SECTION);
  if (capabilities.hasCountdown) sections.push(EXPORT_RUNTIME_COUNTDOWN_SECTION);
  if (capabilities.hasCompositorMotion) sections.push(EXPORT_RUNTIME_COMPOSITOR_MOTION_SECTION);
  if (capabilities.hasTimelineAnimations) sections.push(EXPORT_RUNTIME_TIMELINE_SECTION);
  return buildExportRuntimeScript(adapter, sections.join('\n'));
}

export function buildExportRuntimeScript(adapter: ExportHtmlAdapter, compiledSections: string): string {
  const exitConfig = buildExportExitConfig(adapter);
  const fallbackUrl = JSON.stringify(exitConfig.primaryUrl ?? '');

  return `(()=>{const runtimeNode=document.getElementById('smx-runtime-model');const exitNode=document.getElementById('smx-exit-config');function parseRuntimeJson(node,fallback,label){if(!node)return fallback;try{return JSON.parse(node.textContent||'{}');}catch(error){console.error('[SMX runtime] invalid '+label,error);return fallback;}}const runtime=parseRuntimeJson(runtimeNode,{},'runtime model');const exitConfig=parseRuntimeJson(exitNode,{strategy:${JSON.stringify(exitConfig.strategy)},primaryUrl:${fallbackUrl},urls:[]},'exit config');const scenes=Array.from(document.querySelectorAll('[data-scene-id]'));let activeSceneIndex=0;let sceneTimer=0;function getRuntimeScene(index){if(!runtime||!Array.isArray(runtime.scenes))return null;return runtime.scenes[index]||null;}function findSceneIndexById(sceneId){if(!sceneId)return-1;return scenes.findIndex((scene)=>scene.getAttribute('data-scene-id')===sceneId);}function clearSceneTimer(){if(sceneTimer){window.clearTimeout(sceneTimer);sceneTimer=0;}}function scheduleSceneAdvance(){clearSceneTimer();const sceneRuntime=getRuntimeScene(activeSceneIndex);if(!sceneRuntime)return;const durationMs=Math.max(0,Number(sceneRuntime.durationMs||0));if(!durationMs)return;sceneTimer=window.setTimeout(()=>{const targetIndex=sceneRuntime.nextSceneId?findSceneIndexById(sceneRuntime.nextSceneId):-1;if(targetIndex>=0&&targetIndex!==activeSceneIndex){showScene(targetIndex);return;}if(scenes.length>1)nextScene();},durationMs);}function resolveExitUrl(widgetId){if(runtime&&Array.isArray(runtime.interactions)){const interaction=runtime.interactions.find((item)=>item.widgetId===widgetId&&item.kind==='clickthrough'&&item.url);if(interaction&&interaction.url)return interaction.url;}return exitConfig.primaryUrl||${fallbackUrl};}function performExit(url){const target=url||exitConfig.primaryUrl||${fallbackUrl};if(!target)return;if(exitConfig.strategy==='playable-bridge'&&typeof window.smxPlayableExit==='function'){window.smxPlayableExit(target);return;}if(exitConfig.strategy==='clickTag'){window.clickTag=window.clickTag||target;if(typeof window.smxExit==='function'){window.smxExit(target);return;}}if(typeof window.open==='function')window.open(target,'_blank');}function showScene(index){if(!scenes.length)return;activeSceneIndex=Math.max(0,Math.min(index,scenes.length-1));scenes.forEach((scene,sceneIndex)=>{scene.style.display=sceneIndex===activeSceneIndex?'block':'none';});scheduleSceneAdvance();}function nextScene(){if(!scenes.length)return;showScene((activeSceneIndex+1)%scenes.length);}function previousScene(){if(!scenes.length)return;showScene((activeSceneIndex-1+scenes.length)%scenes.length);}function smxBootstrap(fn){if(typeof window==='undefined'||!window.mraid){fn();return;}var mraid=window.mraid;if(typeof mraid.getState==='function'&&mraid.getState()!=='loading'){fn();}else{mraid.addEventListener('ready',function onMraidReady(){try{mraid.removeEventListener('ready',onMraidReady);}catch(_){}fn();});}}smxBootstrap(function(){document.querySelectorAll('.widget-cta[data-widget-id]').forEach((node)=>{node.addEventListener('click',(event)=>{event.preventDefault();const widgetId=node.getAttribute('data-widget-id')||'';performExit(resolveExitUrl(widgetId));});});${compiledSections}showScene(0);window.smxRuntime={showScene,nextScene,previousScene,performExit,get activeSceneIndex(){return activeSceneIndex;}};});})();`;
}
