import React from 'react';
import {
  Activity,
  Calendar,
  ChevronRight,
  DollarSign,
  Download,
  Eye,
  Film,
  Filter,
  Globe,
  Gauge,
  ImageIcon,
  LayoutDashboard,
  Megaphone,
  MoreHorizontal,
  MousePointerClick,
  Search,
  Send,
  Settings,
  Shield,
  Sparkles,
  Tag,
  Target,
  Users,
} from '../../../system/icons';
import type { Tone } from '../reporting.types';

const toneClasses: Record<Tone, string> = {
  fuchsia: 'border-[color:var(--dusk-border-strong)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
  violet: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  blue: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  cyan: 'border-[color:var(--dusk-status-info-border)] bg-[color:var(--dusk-status-info-bg)] text-[color:var(--dusk-status-info-fg)] shadow-2',
  emerald: 'border-[color:var(--dusk-status-success-border)] bg-[color:var(--dusk-status-success-bg)] text-[color:var(--dusk-status-success-fg)] shadow-2',
  amber: 'border-[color:var(--dusk-status-warning-border)] bg-[color:var(--dusk-status-warning-bg)] text-[color:var(--dusk-status-warning-fg)] shadow-2',
  rose: 'border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] text-[color:var(--dusk-status-critical-fg)] shadow-2',
  slate: 'border-[color:var(--dusk-border-default)] bg-[color:var(--dusk-surface-muted)] text-[color:var(--dusk-text-secondary)]',
};

const iconMap = {
  impressions: Eye,
  clicks: MousePointerClick,
  ctr: Target,
  viewability: Eye,
  video: Film,
  identity: Users,
  attention: Activity,
  campaign: Megaphone,
  tag: Tag,
  creative: ImageIcon,
  geo: Globe,
  tracker: Gauge,
  wallet: DollarSign,
  settings: Settings,
  search: Search,
  filter: Filter,
  calendar: Calendar,
  share: Send,
  export: Download,
  spark: Sparkles,
  dashboard: LayoutDashboard,
  health: Shield,
  more: MoreHorizontal,
  chevron: ChevronRight,
} as const;

export type ReportingIconName = keyof typeof iconMap;

export function BrandIcon({
  name,
  tone,
  compact = false,
  size = 15,
}: {
  name: ReportingIconName;
  tone: Tone;
  compact?: boolean;
  size?: number;
}) {
  const Icon = iconMap[name];

  return (
    <span
      className={[
        'inline-flex items-center justify-center rounded-2xl border backdrop-blur-sm',
        compact ? 'h-9 w-9 rounded-xl' : 'h-11 w-11',
        toneClasses[tone],
      ].join(' ')}
    >
      <Icon className="shrink-0" style={{ height: size, width: size }} />
    </span>
  );
}
