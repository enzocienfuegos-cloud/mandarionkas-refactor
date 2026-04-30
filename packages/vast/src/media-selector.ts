import type { VASTMediaFile } from './types.js';

export interface MediaSelectorOptions {
  maxBitrateKbps?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  preferredTypes?: string[];
  supportsHLS?: boolean;
}

const DEFAULT_TYPE_PRIORITY = [
  'application/x-mpegURL',
  'application/dash+xml',
  'video/mp4',
  'video/webm',
  'video/ogg',
];

export function detectHLSSupport(): boolean {
  if (typeof document === 'undefined') return false;
  const video = document.createElement('video');
  return video.canPlayType('application/vnd.apple.mpegurl') !== '';
}

export function selectBestMediaFile(
  mediaFiles: VASTMediaFile[],
  options: MediaSelectorOptions = {},
): VASTMediaFile | null {
  if (mediaFiles.length === 0) return null;

  const {
    maxBitrateKbps = Infinity,
    viewportWidth = Infinity,
    viewportHeight = Infinity,
    preferredTypes = DEFAULT_TYPE_PRIORITY,
    supportsHLS = detectHLSSupport(),
  } = options;

  const candidates = mediaFiles.filter((file) => {
    if (!supportsHLS && (file.type === 'application/x-mpegURL' || file.type === 'application/dash+xml')) {
      return false;
    }
    if (file.bitrate !== undefined && file.bitrate > maxBitrateKbps) {
      return false;
    }
    return true;
  });

  if (candidates.length === 0) return null;

  const sorted = [...candidates].sort((a, b) => {
    const aPriority = preferredTypes.indexOf(a.type);
    const bPriority = preferredTypes.indexOf(b.type);
    const aTypePrio = aPriority === -1 ? 999 : aPriority;
    const bTypePrio = bPriority === -1 ? 999 : bPriority;
    if (aTypePrio !== bTypePrio) return aTypePrio - bTypePrio;
    return resolutionScore(a, viewportWidth, viewportHeight) - resolutionScore(b, viewportWidth, viewportHeight);
  });

  return sorted[0] ?? null;
}

function resolutionScore(file: VASTMediaFile, targetW: number, targetH: number): number {
  if (!file.width || !file.height) return 500;
  const widthDiff = file.width - targetW;
  const heightDiff = file.height - targetH;
  const wScore = widthDiff >= 0 ? widthDiff : -widthDiff * 4;
  const hScore = heightDiff >= 0 ? heightDiff : -heightDiff * 4;
  return wScore + hScore;
}
