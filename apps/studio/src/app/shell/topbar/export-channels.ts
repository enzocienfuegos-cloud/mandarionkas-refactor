import type { TopBarStudioSnapshot } from './top-bar-types';

export type ExportChannel = TopBarStudioSnapshot['state']['document']['metadata']['release']['targetChannel'];

export const EXPORT_CHANNELS: Array<{ value: ExportChannel; label: string }> = [
  { value: 'generic-html5', label: 'IAB HTML5' },
  { value: 'mraid', label: 'MRAID' },
  { value: 'google-display', label: 'Google Display' },
  { value: 'gam-html5', label: 'GAM HTML5' },
  { value: 'meta-story', label: 'Meta Story' },
  { value: 'tiktok-vertical', label: 'TikTok Vertical' },
];

export function channelLabel(channel: ExportChannel): string {
  return EXPORT_CHANNELS.find((item) => item.value === channel)?.label ?? 'Export';
}

export function channelExportLabel(channel: ExportChannel): string {
  return `${channelLabel(channel)} ZIP`;
}
