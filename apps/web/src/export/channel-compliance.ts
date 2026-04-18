import type { ReleaseTarget } from '../domain/document/types';
import type { ChannelRequirement } from './types';
import type { PortableExportProject } from './portable';
import type { ExportRuntimeModel } from './runtime-model';

export function getPortableChannelRequirements(
  target: ReleaseTarget,
  project: PortableExportProject,
  runtimeModel: ExportRuntimeModel,
): ChannelRequirement[] {
  const { canvas } = project;
  const sceneCount = project.scenes.length;
  const hasClickthrough = project.interactions.some((interaction) => interaction.type === 'open-url' && interaction.url);
  const hasVideoHero = project.scenes.some((scene) => scene.widgets.some((widget) => widget.type === 'video-hero'));
  const videoHeroCount = project.scenes.reduce((sum, scene) => sum + scene.widgets.filter((widget) => widget.type === 'video-hero').length, 0);
  const hasPosterFallback = project.scenes.some((scene) =>
    scene.widgets.some((widget) => widget.type === 'hero-image' || widget.type === 'image'),
  );
  const hasDragGesture = runtimeModel.scenes.some((scene) => scene.widgets.some((widget) => widget.gestures.includes('drag')));
  const hasTapGesture = runtimeModel.interactions.some((interaction) => interaction.gesture === 'tap');
  const hasPlayableOnlyGesture = runtimeModel.scenes.some((scene) =>
    scene.widgets.some((widget) => widget.gestures.includes('drag') || widget.gestures.includes('slider') || widget.gestures.includes('scratch')),
  );
  const remoteAssetCount = project.assets.filter((asset) => /^https?:\/\//i.test(asset.src)).length;
  const sceneWithMediaCount = project.scenes.filter((scene) =>
    scene.widgets.some((widget) => widget.type === 'hero-image' || widget.type === 'image' || widget.type === 'video-hero'),
  ).length;

  switch (target) {
    case 'google-display':
      return [
        {
          id: 'gwd-size',
          label: 'Canvas uses a standard display size',
          passed: [[300, 250], [300, 600], [970, 250], [320, 480]].some(([w, h]) => w === canvas.width && h === canvas.height),
          severity: 'warning',
        },
        {
          id: 'gwd-scenes',
          label: 'Creative keeps a compact scene count (<= 3)',
          passed: sceneCount <= 3,
          severity: 'warning',
        },
        {
          id: 'gwd-exit',
          label: 'Creative includes a clickthrough action',
          passed: hasClickthrough,
          severity: 'error',
        },
        {
          id: 'gwd-no-playable-gestures',
          label: 'Display package avoids playable-only drag/slider/scratch gestures',
          passed: !hasPlayableOnlyGesture,
          severity: 'warning',
        },
        {
          id: 'gwd-video-count',
          label: 'Display package keeps video usage compact (<= 1 video hero)',
          passed: videoHeroCount <= 1,
          severity: 'warning',
        },
      ];
    case 'gam-html5':
      return [
        {
          id: 'gam-cta',
          label: 'At least one CTA/open-url action exists',
          passed: hasClickthrough,
          severity: 'error',
        },
        {
          id: 'gam-video-fallback',
          label: 'Video creatives include poster or image fallback',
          passed: !hasVideoHero || hasPosterFallback,
          severity: 'warning',
        },
        {
          id: 'gam-single-entry',
          label: 'Runtime has a clear entry scene',
          passed: Boolean(runtimeModel.scenes[0]?.id),
          severity: 'error',
        },
        {
          id: 'gam-scene-budget',
          label: 'HTML5 ad keeps scene count manageable (<= 5)',
          passed: sceneCount <= 5,
          severity: 'warning',
        },
        {
          id: 'gam-remote-assets',
          label: 'Package limits remote asset references for ad hosting',
          passed: remoteAssetCount <= 6,
          severity: 'warning',
        },
      ];
    case 'mraid':
      return [
        {
          id: 'mraid-size',
          label: 'Canvas uses an MRAID profile size (320x480 or 300x600)',
          passed: [[320, 480], [300, 600]].some(([w, h]) => w === canvas.width && h === canvas.height),
          severity: 'warning',
        },
        {
          id: 'mraid-exit',
          label: 'Creative includes a clickthrough action for mraid.open()',
          passed: hasClickthrough,
          severity: 'error',
        },
        {
          id: 'mraid-scene-budget',
          label: 'MRAID creative keeps scene count compact (<= 3)',
          passed: sceneCount <= 3,
          severity: 'warning',
        },
        {
          id: 'mraid-mobile-orientation',
          label: 'MRAID portrait interstitials stay mobile-oriented',
          passed: canvas.height >= canvas.width,
          severity: 'warning',
        },
      ];
    case 'meta-story':
      return [
        {
          id: 'meta-ratio',
          label: 'Canvas is vertical 9:16',
          passed: canvas.width === 1080 && canvas.height === 1920,
          severity: 'warning',
        },
        {
          id: 'meta-short-flow',
          label: 'Story flow stays compact (<= 4 scenes)',
          passed: sceneCount <= 4,
          severity: 'warning',
        },
        {
          id: 'meta-media',
          label: 'Story includes at least one strong media scene',
          passed: sceneWithMediaCount > 0,
          severity: 'warning',
        },
        {
          id: 'meta-exit',
          label: 'Story includes a tap/clickthrough destination',
          passed: hasClickthrough || hasTapGesture,
          severity: 'warning',
        },
      ];
    case 'tiktok-vertical':
      return [
        {
          id: 'tiktok-ratio',
          label: 'Canvas is vertical 9:16',
          passed: canvas.width === 1080 && canvas.height === 1920,
          severity: 'warning',
        },
        {
          id: 'tiktok-playable-gesture',
          label: 'Interactive vertical creatives use tap or drag gestures',
          passed: hasTapGesture || hasDragGesture,
          severity: 'warning',
        },
        {
          id: 'tiktok-media',
          label: 'TikTok vertical includes at least one media-driven scene',
          passed: sceneWithMediaCount > 0,
          severity: 'warning',
        },
        {
          id: 'tiktok-scene-budget',
          label: 'Vertical flow stays compact enough for swipeable delivery (<= 5 scenes)',
          passed: sceneCount <= 5,
          severity: 'warning',
        },
      ];
    case 'generic-html5':
    default:
      return [
        {
          id: 'html5-name',
          label: 'Document has export name',
          passed: Boolean(project.name.trim()),
          severity: 'error',
        },
        {
          id: 'html5-size',
          label: 'Canvas size is configured',
          passed: canvas.width > 0 && canvas.height > 0,
          severity: 'error',
        },
        {
          id: 'html5-entry-scene',
          label: 'Runtime defines an entry scene',
          passed: Boolean(runtimeModel.scenes[0]?.id),
          severity: 'error',
        },
        {
          id: 'html5-exit',
          label: 'Interactive HTML5 creatives include a clickthrough path',
          passed: !runtimeModel.scenes.some((scene) => scene.widgets.some((widget) => widget.interactive)) || hasClickthrough,
          severity: 'warning',
        },
      ];
  }
}
