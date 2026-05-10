import React from 'react';
import {
  Activity,
  DollarSign,
  Eye,
  Hourglass,
  Layers,
  MousePointerClick,
  PlaySquare,
  Repeat2,
  ScanEye,
  ShieldAlert,
  Sigma,
  Target,
  TrendingUp,
  Users,
} from '../icons';
import type { MetricIconKind } from './registry';

export function MetricIcon({ icon }: { icon: MetricIconKind }) {
  switch (icon) {
    case 'spend':
      return <DollarSign className="h-4 w-4" />;
    case 'impressions':
      return <Layers className="h-4 w-4" />;
    case 'ctr':
      return <TrendingUp className="h-4 w-4" />;
    case 'engagements':
      return <Activity className="h-4 w-4" />;
    case 'viewability':
      return <Eye className="h-4 w-4" />;
    case 'clicks':
      return <MousePointerClick className="h-4 w-4" />;
    case 'ecpc':
    case 'ecpm':
    case 'ecpv':
    case 'roas':
      return <DollarSign className="h-4 w-4" />;
    case 'conversions':
    case 'cvr':
      return <Target className="h-4 w-4" />;
    case 'viewable_imps':
      return <Eye className="h-4 w-4" />;
    case 'attention':
      return <ScanEye className="h-4 w-4" />;
    case 'in_view_time':
    case 'dwell':
      return <Hourglass className="h-4 w-4" />;
    case 'video_starts':
    case 'video_completes':
    case 'vtr':
      return <PlaySquare className="h-4 w-4" />;
    case 'completion_rate':
      return <Sigma className="h-4 w-4" />;
    case 'unique_users':
    case 'reach':
      return <Users className="h-4 w-4" />;
    case 'frequency':
      return <Repeat2 className="h-4 w-4" />;
    case 'fraud_rate':
    case 'ivt':
    case 'mfa':
    case 'brand_safety':
      return <ShieldAlert className="h-4 w-4" />;
    default:
      return null;
  }
}
