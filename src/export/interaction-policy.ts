import type { ReleaseTarget } from '../domain/document/types';
import type { ExportInteractionPolicy } from './types';

export function getInteractionPolicy(target: ReleaseTarget): ExportInteractionPolicy {
  switch (target) {
    case 'meta-story':
    case 'tiktok-vertical':
      return {
        tier: 'banner-runtime',
        responsiveMode: 'adaptive',
        supportsScenes: true,
        supportsMultipleExits: true,
        supportsHotspots: true,
        supportsDrag: false,
        supportsSwipe: false,
        supportsPlayableState: false,
      };
    case 'generic-html5':
    case 'google-display':
    case 'gam-html5':
    default:
      return {
        tier: 'banner-runtime',
        responsiveMode: 'adaptive',
        supportsScenes: true,
        supportsMultipleExits: true,
        supportsHotspots: true,
        supportsDrag: false,
        supportsSwipe: false,
        supportsPlayableState: false,
      };
  }
}
