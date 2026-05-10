import React from 'react';
import { Badge } from '../../system';
import type { MetricTone } from '../../system';
import type { PrioritySeverity, Tone, TrendDirection } from './types';
import { classNames, discrepancyStatusBadge, severityBadge } from './utils';
import type { DiscrepancyStatus } from './types';

type IconProps = { className?: string };

function iconProps(className?: string) {
  return {
    className: classNames('h-5 w-5', className),
    viewBox: '0 0 24 24',
    fill: 'none',
    'aria-hidden': true,
  } as const;
}

export const AlertTriangleIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M12 4 3.5 19h17L12 4Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    <path d="M12 9v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <circle cx="12" cy="16" r="1" fill="currentColor" />
  </svg>
);

export const SearchIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.8" />
    <path d="m21 21-4.3-4.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const FilterIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const ReportIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <path d="M6 19V9M12 19V5M18 19v-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    <path d="M4 19h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export const TableIcon = ({ className }: IconProps) => (
  <svg {...iconProps(className)}>
    <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M4 10h16M10 5v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export function toneToMetricTone(tone: Tone): MetricTone {
  switch (tone) {
    case 'fuchsia':
      return 'brand';
    case 'emerald':
      return 'success';
    case 'amber':
      return 'warning';
    case 'rose':
      return 'critical';
    case 'sky':
      return 'info';
    default:
      return 'neutral';
  }
}

export function DiscrepancyStatusPill({ status }: { status: DiscrepancyStatus }) {
  return <Badge tone={discrepancyStatusBadge(status) as 'success' | 'warning' | 'critical' | 'info' | 'neutral'} size="sm">{status}</Badge>;
}

export function SeverityPill({ severity }: { severity: PrioritySeverity }) {
  return <Badge tone={severityBadge(severity) as 'critical' | 'warning' | 'info'} size="sm">{severity}</Badge>;
}

export function TrendBadge({ direction, value }: { direction: TrendDirection; value: string }) {
  const tone = direction === 'up' ? 'success' : direction === 'down' ? 'critical' : 'neutral';
  return <Badge tone={tone} size="sm">{value}</Badge>;
}
