import type { ReleaseTarget, StudioState } from '../domain/document/types';
import type { ChannelRequirement } from './types';

export type ExportChannelProfile = {
  id: ReleaseTarget;
  label: string;
  family: 'generic-html5' | 'iab-html5' | 'mraid' | 'social' | 'display';
  deliveryMode: 'html5' | 'mraid';
  exitStrategy: 'window-open' | 'mraid-open';
  supportedSizes?: Array<{ width: number; height: number }>;
  recommendedSceneCount?: number;
  getRequirements: (state: StudioState) => ChannelRequirement[];
};

function hasOpenUrlAction(state: StudioState): boolean {
  return Object.values(state.document.actions).some((action) => action.type === 'open-url' && action.url);
}

function hasWidget(state: StudioState, widgetType: string): boolean {
  return Object.values(state.document.widgets).some((widget) => widget.type === widgetType);
}

function usesCompactStandardDisplaySize(state: StudioState, sizes: Array<[number, number]>): boolean {
  return sizes.some(([width, height]) => state.document.canvas.width === width && state.document.canvas.height === height);
}

export const EXPORT_CHANNEL_PROFILES: Record<ReleaseTarget, ExportChannelProfile> = {
  'generic-html5': {
    id: 'generic-html5',
    label: 'Generic HTML5',
    family: 'generic-html5',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    getRequirements: (state) => [
      { id: 'html5-name', label: 'Document has export name', passed: Boolean(state.document.name.trim()), severity: 'error' },
      { id: 'html5-size', label: 'Canvas size is configured', passed: state.document.canvas.width > 0 && state.document.canvas.height > 0, severity: 'error' },
    ],
  },
  'iab-html5': {
    id: 'iab-html5',
    label: 'IAB HTML5',
    family: 'iab-html5',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    supportedSizes: [
      { width: 300, height: 250 },
      { width: 300, height: 600 },
      { width: 320, height: 480 },
      { width: 970, height: 250 },
    ],
    recommendedSceneCount: 3,
    getRequirements: (state) => [
      { id: 'iab-size', label: 'Canvas uses a common IAB size', passed: usesCompactStandardDisplaySize(state, [[300, 250], [300, 600], [320, 480], [970, 250]]), severity: 'warning' },
      { id: 'iab-cta', label: 'At least one clickthrough/open-url action exists', passed: hasOpenUrlAction(state), severity: 'error' },
      { id: 'iab-scenes', label: 'Creative keeps a compact scene count (<= 3)', passed: state.document.scenes.length <= 3, severity: 'warning' },
    ],
  },
  mraid: {
    id: 'mraid',
    label: 'MRAID',
    family: 'mraid',
    deliveryMode: 'mraid',
    exitStrategy: 'mraid-open',
    supportedSizes: [
      { width: 300, height: 600 },
      { width: 320, height: 480 },
    ],
    recommendedSceneCount: 3,
    getRequirements: (state) => [
      { id: 'mraid-size', label: 'Canvas matches a mobile MRAID target size', passed: usesCompactStandardDisplaySize(state, [[300, 600], [320, 480]]), severity: 'warning' },
      { id: 'mraid-cta', label: 'At least one exit/open-url action exists', passed: hasOpenUrlAction(state), severity: 'error' },
      { id: 'mraid-scenes', label: 'Creative keeps scene count compact (<= 3)', passed: state.document.scenes.length <= 3, severity: 'warning' },
      { id: 'mraid-video', label: 'Video-heavy creative has fallback strategy', passed: !hasWidget(state, 'video-hero') || hasWidget(state, 'hero-image') || hasWidget(state, 'image'), severity: 'warning' },
    ],
  },
  'google-display': {
    id: 'google-display',
    label: 'Google Display',
    family: 'display',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    supportedSizes: [
      { width: 300, height: 250 },
      { width: 300, height: 600 },
      { width: 320, height: 480 },
      { width: 970, height: 250 },
    ],
    recommendedSceneCount: 3,
    getRequirements: (state) => [
      { id: 'gwd-size', label: 'Canvas uses a standard display size', passed: usesCompactStandardDisplaySize(state, [[300, 250], [300, 600], [970, 250], [320, 480]]), severity: 'warning' },
      { id: 'gwd-scenes', label: 'Creative keeps a compact scene count (<= 3)', passed: state.document.scenes.length <= 3, severity: 'warning' },
    ],
  },
  'gam-html5': {
    id: 'gam-html5',
    label: 'GAM HTML5',
    family: 'display',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    getRequirements: (state) => [
      { id: 'gam-cta', label: 'At least one CTA/open-url action exists', passed: hasOpenUrlAction(state), severity: 'error' },
      { id: 'gam-video', label: 'Video hero has a fallback/poster strategy', passed: !hasWidget(state, 'video-hero') || hasWidget(state, 'hero-image') || hasWidget(state, 'image'), severity: 'warning' },
    ],
  },
  'meta-story': {
    id: 'meta-story',
    label: 'Meta Story',
    family: 'social',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    getRequirements: (state) => [
      { id: 'meta-ratio', label: 'Canvas is vertical 9:16', passed: state.document.canvas.width === 1080 && state.document.canvas.height === 1920, severity: 'warning' },
      { id: 'meta-map', label: 'Story avoids dense map-heavy layout', passed: !hasWidget(state, 'dynamic-map') || state.document.scenes.length <= 2, severity: 'warning' },
    ],
  },
  'tiktok-vertical': {
    id: 'tiktok-vertical',
    label: 'TikTok Vertical',
    family: 'social',
    deliveryMode: 'html5',
    exitStrategy: 'window-open',
    getRequirements: (state) => [
      { id: 'tiktok-ratio', label: 'Canvas is vertical 9:16', passed: state.document.canvas.width === 1080 && state.document.canvas.height === 1920, severity: 'warning' },
      { id: 'tiktok-runtime', label: 'Preview uses short scene flow (<= 4 scenes)', passed: state.document.scenes.length <= 4, severity: 'warning' },
    ],
  },
};

export function getExportChannelProfile(target: ReleaseTarget): ExportChannelProfile {
  return EXPORT_CHANNEL_PROFILES[target] ?? EXPORT_CHANNEL_PROFILES['generic-html5'];
}

export function listExportChannelProfiles(): ExportChannelProfile[] {
  return Object.values(EXPORT_CHANNEL_PROFILES);
}
