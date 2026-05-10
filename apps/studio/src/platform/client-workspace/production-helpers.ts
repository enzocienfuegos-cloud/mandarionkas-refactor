import { getCanvasPresetById } from '../../domain/document/canvas-presets';
import type { WorkspaceProjectItem } from './WorkspaceProjectViews';

export type QuickFilterId = 'all' | 'html5' | 'mraid' | 'vast' | 'static' | 'playable' | 'draft' | 'qa' | 'live';
export type BannerFormatKey = Exclude<QuickFilterId, 'all' | 'draft' | 'qa' | 'live'>;
export type BannerStatusKey = Extract<QuickFilterId, 'draft' | 'qa' | 'live'> | 'review' | 'archived';

export type CampaignGroup = {
  id: string;
  name: string;
  folderId?: string;
  clientName: string;
  status: BannerStatusKey;
  updatedAt: string;
  projects: WorkspaceProjectItem[];
};

export function resolveFormatKey(project: WorkspaceProjectItem): BannerFormatKey {
  switch (project.channel) {
    case 'mraid':
      return 'mraid';
    case 'vast-simid':
      return 'vast';
    case 'playable':
      return 'playable';
    case 'static':
      return 'static';
    case 'google-display':
    case 'generic-html5':
    default:
      return 'html5';
  }
}

export function resolveStatusKey(project: WorkspaceProjectItem): BannerStatusKey {
  switch (project.workspaceStatus) {
    case 'draft':
      return 'draft';
    case 'review':
      return 'qa';
    case 'exported':
      return 'live';
    case 'archived':
      return 'archived';
    case 'ready':
    default:
      return 'review';
  }
}

export function resolveStatusLabel(status: BannerStatusKey): string {
  switch (status) {
    case 'qa':
      return 'QA';
    case 'live':
      return 'Live';
    case 'review':
      return 'Review';
    case 'draft':
      return 'Draft';
    case 'archived':
      return 'Archived';
    default:
      return status;
  }
}

export function resolveBannerRuntime(project: WorkspaceProjectItem): string {
  switch (resolveFormatKey(project)) {
    case 'vast':
      return `${Math.max((project.sceneCount ?? 1) * 5, 15)}s`;
    case 'playable':
      return 'Interactive';
    case 'mraid':
      return 'Tap-ready';
    case 'static':
      return 'Single frame';
    case 'html5':
    default:
      return `${Math.max(project.sceneCount ?? 1, 1)} scene`;
  }
}

export function resolveBannerFormatLabel(project: WorkspaceProjectItem): string {
  switch (resolveFormatKey(project)) {
    case 'mraid':
      return 'HTML5 · MRAID';
    case 'vast':
      return 'MP4 · VAST 4.2';
    case 'playable':
      return 'HTML5 · Playable';
    case 'static':
      return 'Static · PNG';
    case 'html5':
    default:
      return 'HTML5 · Display';
  }
}

export function resolveWeightEstimate(project: WorkspaceProjectItem): string {
  const preset = getCanvasPresetById(project.canvasPresetId);
  const areaFactor = preset ? Math.max(1, Math.round((preset.width * preset.height) / 90000)) : 1;
  const sceneCount = Math.max(project.sceneCount ?? 1, 1);
  const widgetCount = Math.max(project.widgetCount ?? 0, 1);
  const format = resolveFormatKey(project);
  const baseKb = format === 'vast'
    ? 1240
    : format === 'playable'
      ? 360
      : format === 'mraid'
        ? 210
        : format === 'static'
          ? 92
          : 148;
  const totalKb = baseKb + (sceneCount * 18) + (widgetCount * 7) + (areaFactor * 16);
  if (totalKb >= 1024) return `${(totalKb / 1024).toFixed(1)}mb`;
  return `${Math.round(totalKb)}kb`;
}

export function resolveGroupKey(project: WorkspaceProjectItem, folderId?: string): string {
  if (folderId) return `folder:${folderId}`;
  if (project.campaignName?.trim()) return `campaign:${project.campaignName.trim().toLowerCase()}`;
  return 'campaign:unfiled';
}

export function resolveGroupName(project: WorkspaceProjectItem, folderName?: string): string {
  return folderName ?? project.campaignName?.trim() ?? 'Unfiled banners';
}

export function resolveThumbVariant(project: WorkspaceProjectItem): 'landscape' | 'portrait' | 'square' {
  const preset = getCanvasPresetById(project.canvasPresetId);
  if (!preset?.width || !preset?.height) return 'landscape';
  if (preset.width === preset.height) return 'square';
  return preset.width > preset.height ? 'landscape' : 'portrait';
}

export function formatCanvas(project: WorkspaceProjectItem): string {
  const preset = getCanvasPresetById(project.canvasPresetId);
  if (!preset?.width || !preset?.height) return 'Custom';
  return `${preset.width}×${preset.height}`;
}

export function matchesQuickFilter(project: WorkspaceProjectItem, quickFilter: QuickFilterId): boolean {
  if (quickFilter === 'all') return true;
  const formatKey = resolveFormatKey(project);
  const statusKey = resolveStatusKey(project);
  if (quickFilter === 'draft' || quickFilter === 'qa' || quickFilter === 'live') {
    return statusKey === quickFilter;
  }
  return formatKey === quickFilter;
}
