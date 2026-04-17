import type { ReleaseTarget, StudioState } from '../domain/document/types';
import type { ChannelRequirement } from './types';

export function getChannelRequirements(target: ReleaseTarget, state: StudioState): ChannelRequirement[] {
  const canvas = state.document.canvas;
  const hasVideoHero = Object.values(state.document.widgets).some((widget) => widget.type === 'video-hero');
  const hasMap = Object.values(state.document.widgets).some((widget) => widget.type === 'dynamic-map');
  const sceneCount = state.document.scenes.length;

  switch (target) {
    case 'google-display':
      return [
        { id: 'gwd-size', label: 'Canvas uses a standard display size', passed: [[300,250],[300,600],[970,250],[320,480]].some(([w,h]) => w === canvas.width && h === canvas.height), severity: 'warning' },
        { id: 'gwd-scenes', label: 'Creative keeps a compact scene count (<= 3)', passed: sceneCount <= 3, severity: 'warning' },
      ];
    case 'gam-html5':
      return [
        { id: 'gam-cta', label: 'At least one CTA/open-url action exists', passed: Object.values(state.document.actions).some((action) => action.type === 'open-url' && action.url), severity: 'error' },
        { id: 'gam-video', label: 'Video hero has a fallback/poster strategy', passed: !hasVideoHero || Object.values(state.document.widgets).some((widget) => widget.type === 'hero-image' || widget.type === 'image'), severity: 'warning' },
      ];
    case 'meta-story':
      return [
        { id: 'meta-ratio', label: 'Canvas is vertical 9:16', passed: canvas.width === 1080 && canvas.height === 1920, severity: 'warning' },
        { id: 'meta-map', label: 'Story avoids dense map-heavy layout', passed: !hasMap || sceneCount <= 2, severity: 'warning' },
      ];
    case 'tiktok-vertical':
      return [
        { id: 'tiktok-ratio', label: 'Canvas is vertical 9:16', passed: canvas.width === 1080 && canvas.height === 1920, severity: 'warning' },
        { id: 'tiktok-runtime', label: 'Preview uses short scene flow (<= 4 scenes)', passed: sceneCount <= 4, severity: 'warning' },
      ];
    case 'generic-html5':
    default:
      return [
        { id: 'html5-name', label: 'Document has export name', passed: Boolean(state.document.name.trim()), severity: 'error' },
        { id: 'html5-size', label: 'Canvas size is configured', passed: canvas.width > 0 && canvas.height > 0, severity: 'error' },
      ];
  }
}
