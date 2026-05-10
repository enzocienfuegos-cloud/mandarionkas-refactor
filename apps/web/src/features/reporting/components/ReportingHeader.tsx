import React from 'react';
import { PageHeader } from '../../../system';
import type { ReportingMode, ReportingModeConfig } from '../reporting.types';
import { ChannelSwitcher } from './ChannelSwitcher';

export function ReportingHeader({
  mode,
  config,
  onModeChange,
}: {
  mode: ReportingMode;
  config: ReportingModeConfig;
  onModeChange: (mode: ReportingMode) => void;
}) {
  return (
    <PageHeader
      kicker={`Reporting · ${config.label}`}
      title={config.title}
      meta={config.subtitle}
      secondaryActions={<ChannelSwitcher mode={mode} onModeChange={onModeChange} />}
    />
  );
}
