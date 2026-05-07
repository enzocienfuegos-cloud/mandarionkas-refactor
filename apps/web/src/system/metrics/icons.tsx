import React from 'react';
import { Activity, BarChart3, DollarSign, Eye, MousePointerClick } from '../icons';
import type { MetricIconKind } from './registry';

export function MetricIcon({ icon }: { icon: MetricIconKind }) {
  switch (icon) {
    case 'spend':
      return <DollarSign className="h-4 w-4" />;
    case 'impressions':
      return <BarChart3 className="h-4 w-4" />;
    case 'ctr':
      return <MousePointerClick className="h-4 w-4" />;
    case 'engagements':
      return <Activity className="h-4 w-4" />;
    case 'viewability':
      return <Eye className="h-4 w-4" />;
    default:
      return null;
  }
}
