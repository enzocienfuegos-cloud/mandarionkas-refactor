import type { WidgetLibraryGroup } from '../../../widgets/registry/widget-definition';

export const CATEGORY_COLOR: Record<WidgetLibraryGroup, {
  cssVar: string;
  badgeClass: string;
  thumbTint: string;
}> = {
  essentials: { cssVar: '--cobalt-chip-border', badgeClass: 'chip--cobalt', thumbTint: 'rgba(37, 99, 235, 0.10)' },
  commerce: { cssVar: '--amber-chip-border', badgeClass: 'chip--amber', thumbTint: 'rgba(245, 158, 11, 0.10)' },
  'video-social': { cssVar: '--violet-chip-border', badgeClass: 'chip--violet', thumbTint: 'rgba(111, 60, 255, 0.10)' },
  interactive: { cssVar: '--cyan-chip-border', badgeClass: 'chip--cyan', thumbTint: 'rgba(48, 232, 255, 0.08)' },
  'data-utility': { cssVar: '--slate-chip-border', badgeClass: 'chip--slate', thumbTint: 'rgba(148, 163, 184, 0.10)' },
  'premium-fx': { cssVar: '--pink-chip-border', badgeClass: 'chip--pink', thumbTint: 'rgba(139, 92, 255, 0.12)' },
};
