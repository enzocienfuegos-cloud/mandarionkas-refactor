import { kpisByMode } from './reporting.mock';
import type { ReportingModeConfig } from './reporting.types';

const allWidgets = [
  { id: 'trend-all', type: 'trend', title: 'Performance over time', icon: 'spark', tone: 'fuchsia', size: 'wide', order: 1, defaultVisible: true, visibleIn: ['all'] },
  { id: 'video-funnel-all', type: 'videoFunnel', title: 'Video completion funnel', icon: 'video', tone: 'blue', size: 'medium', order: 2, defaultVisible: true, visibleIn: ['all', 'video'] },
  { id: 'campaign-performance', type: 'campaignPerformance', title: 'Top display campaigns', icon: 'campaign', tone: 'fuchsia', size: 'large', order: 3, defaultVisible: true, visibleIn: ['all', 'display'] },
  { id: 'video-format', type: 'videoFormat', title: 'Video by format', icon: 'video', tone: 'blue', size: 'medium', order: 4, defaultVisible: true, visibleIn: ['all', 'video'] },
  { id: 'identity-insights', type: 'identityInsights', title: 'Identity insights', icon: 'identity', tone: 'emerald', size: 'medium', order: 5, defaultVisible: true, visibleIn: ['all', 'identity'] },
  { id: 'top-regions', type: 'topRegions', title: 'Top regions', icon: 'geo', tone: 'violet', size: 'medium', order: 6, defaultVisible: true, visibleIn: ['all', 'display', 'video', 'identity'] },
  { id: 'top-creatives', type: 'topCreatives', title: 'Top creatives', icon: 'creative', tone: 'fuchsia', size: 'medium', order: 7, defaultVisible: true, visibleIn: ['all', 'display', 'video'] },
  { id: 'tracker-health', type: 'trackerHealth', title: 'Tracker health', icon: 'tracker', tone: 'amber', size: 'medium', order: 8, defaultVisible: true, visibleIn: ['all', 'display', 'video'] },
  { id: 'recommendations', type: 'recommendations', title: 'Insights & recommendations', icon: 'health', tone: 'slate', size: 'medium', order: 9, defaultVisible: true, visibleIn: ['all', 'display', 'video', 'identity'] },
  { id: 'display-table', type: 'displayTable', title: 'Campaign performance', icon: 'campaign', tone: 'fuchsia', size: 'wide', order: 10, defaultVisible: true, visibleIn: ['display'] },
  { id: 'tag-table', type: 'tagPerformance', title: 'Tag performance', icon: 'tag', tone: 'fuchsia', size: 'large', order: 11, defaultVisible: true, visibleIn: ['display'] },
  { id: 'creative-table', type: 'creativePerformance', title: 'Creative performance', icon: 'creative', tone: 'fuchsia', size: 'large', order: 12, defaultVisible: true, visibleIn: ['display'] },
  { id: 'identity-frequency', type: 'identityFrequency', title: 'Identity frequency buckets', icon: 'identity', tone: 'emerald', size: 'large', order: 13, defaultVisible: true, visibleIn: ['identity'] },
  { id: 'identity-keys', type: 'identityKeys', title: 'Identity keys by event', icon: 'identity', tone: 'emerald', size: 'medium', order: 14, defaultVisible: true, visibleIn: ['identity'] },
  { id: 'identity-attribution', type: 'identityAttribution', title: 'Attribution windows', icon: 'tracker', tone: 'emerald', size: 'medium', order: 15, defaultVisible: true, visibleIn: ['identity'] },
  { id: 'audience-export', type: 'audienceExport', title: 'Audience export panel', icon: 'export', tone: 'emerald', size: 'medium', order: 16, defaultVisible: true, visibleIn: ['identity'] },
] satisfies ReportingModeConfig['widgets'];

export const reportingModeConfig: Record<ReportingModeConfig['id'], ReportingModeConfig> = {
  all: {
    id: 'all',
    label: 'All Channels',
    title: 'Cross-channel reporting command center',
    subtitle: 'Unified cross-channel performance across Display, Video, and Identity.',
    accent: 'fuchsia',
    kpis: kpisByMode.all,
    widgets: allWidgets,
  },
  display: {
    id: 'display',
    label: 'Display',
    title: 'Display reporting without fragmentation',
    subtitle: 'Display delivery, click performance, viewability, creative, site, and regional insights.',
    accent: 'fuchsia',
    kpis: kpisByMode.display,
    widgets: allWidgets,
  },
  video: {
    id: 'video',
    label: 'Video',
    title: 'Video performance and playback health',
    subtitle: 'Video starts, quartiles, completions, formats, watch time, and playback health.',
    accent: 'blue',
    kpis: kpisByMode.video,
    widgets: allWidgets,
  },
  identity: {
    id: 'identity',
    label: 'Identity',
    title: 'Identity reach and audience export readiness',
    subtitle: 'Identity reach, match rate, frequency, attribution, and audience export readiness.',
    accent: 'emerald',
    kpis: kpisByMode.identity,
    widgets: allWidgets,
  },
};
