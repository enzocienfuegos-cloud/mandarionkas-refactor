import type { ReleaseTarget } from '../domain/document/types';
import type { ChannelRequirement } from './types';

export type ChannelBudget = {
  maxZipBytes: number;
  maxInitialLoadBytes: number;
  maxRuntimeJsBytes: number;
  maxAssetCount: number;
  overrunSeverity: 'error' | 'warning';
};

export type BudgetMeasurement = {
  zipBytes: number;
  initialLoadBytes: number;
  runtimeJsBytes: number;
  assetCount: number;
};

export type BudgetCheckResult = {
  budget: ChannelBudget;
  measurement: BudgetMeasurement;
  overruns: Array<{
    field: keyof BudgetMeasurement;
    actual: number;
    limit: number;
    severity: 'error' | 'warning';
  }>;
  pass: boolean;
};

export const CHANNEL_BUDGETS: Record<ReleaseTarget, ChannelBudget> = {
  'mraid': {
    maxZipBytes: 1_000_000,
    maxInitialLoadBytes: 300_000,
    maxRuntimeJsBytes: 150_000,
    maxAssetCount: 35,
    overrunSeverity: 'error',
  },
  'gam-html5': {
    maxZipBytes: 2_200_000,
    maxInitialLoadBytes: 500_000,
    maxRuntimeJsBytes: 200_000,
    maxAssetCount: 50,
    overrunSeverity: 'error',
  },
  'google-display': {
    maxZipBytes: 2_500_000,
    maxInitialLoadBytes: 500_000,
    maxRuntimeJsBytes: 200_000,
    maxAssetCount: 50,
    overrunSeverity: 'warning',
  },
  'generic-html5': {
    maxZipBytes: 2_500_000,
    maxInitialLoadBytes: 500_000,
    maxRuntimeJsBytes: 200_000,
    maxAssetCount: 50,
    overrunSeverity: 'warning',
  },
  'meta-story': {
    maxZipBytes: 5_000_000,
    maxInitialLoadBytes: 1_000_000,
    maxRuntimeJsBytes: 300_000,
    maxAssetCount: 80,
    overrunSeverity: 'warning',
  },
  'tiktok-vertical': {
    maxZipBytes: 5_000_000,
    maxInitialLoadBytes: 1_000_000,
    maxRuntimeJsBytes: 300_000,
    maxAssetCount: 80,
    overrunSeverity: 'warning',
  },
  'vast-simid': {
    maxZipBytes: 200_000,
    maxInitialLoadBytes: 100_000,
    maxRuntimeJsBytes: 80_000,
    maxAssetCount: 5,
    overrunSeverity: 'error',
  },
};

function formatBytes(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)} MB`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} KB`;
  return `${value} B`;
}

function formatMeasurementValue(field: keyof BudgetMeasurement, value: number): string {
  return field === 'assetCount' ? String(value) : formatBytes(value);
}

function buildBudgetLabel(field: keyof BudgetMeasurement, actual: number, limit: number): string {
  switch (field) {
    case 'zipBytes':
      return `ZIP bundle stays within ${formatBytes(limit)} (actual ${formatBytes(actual)})`;
    case 'initialLoadBytes':
      return `Initial load stays within ${formatBytes(limit)} (actual ${formatBytes(actual)})`;
    case 'runtimeJsBytes':
      return `Runtime JS stays within ${formatBytes(limit)} (actual ${formatBytes(actual)})`;
    case 'assetCount':
      return `Asset count stays within ${limit} files (actual ${actual})`;
    default:
      return `${field} stays within ${formatMeasurementValue(field, limit)} (actual ${formatMeasurementValue(field, actual)})`;
  }
}

export function checkChannelBudget(
  target: ReleaseTarget,
  measurement: BudgetMeasurement,
): BudgetCheckResult {
  const budget = CHANNEL_BUDGETS[target];
  const overruns: BudgetCheckResult['overruns'] = [];

  const checks: Array<[keyof BudgetMeasurement, number]> = [
    ['zipBytes', budget.maxZipBytes],
    ['initialLoadBytes', budget.maxInitialLoadBytes],
    ['runtimeJsBytes', budget.maxRuntimeJsBytes],
    ['assetCount', budget.maxAssetCount],
  ];

  checks.forEach(([field, limit]) => {
    const actual = measurement[field];
    if (actual > limit) {
      overruns.push({ field, actual, limit, severity: budget.overrunSeverity });
    }
  });

  return {
    budget,
    measurement,
    overruns,
    pass: !overruns.some((item) => item.severity === 'error'),
  };
}

export function buildBudgetRequirements(
  target: ReleaseTarget,
  measurement: BudgetMeasurement,
): ChannelRequirement[] {
  const result = checkChannelBudget(target, measurement);
  const { budget } = result;
  const limits: Record<keyof BudgetMeasurement, number> = {
    zipBytes: budget.maxZipBytes,
    initialLoadBytes: budget.maxInitialLoadBytes,
    runtimeJsBytes: budget.maxRuntimeJsBytes,
    assetCount: budget.maxAssetCount,
  };

  return (Object.keys(limits) as Array<keyof BudgetMeasurement>).map((field) => {
    const actual = measurement[field];
    const limit = limits[field];
    const overrun = result.overruns.find((item) => item.field === field);

    return {
      id: `budget-${field}`,
      label: buildBudgetLabel(field, actual, limit),
      passed: !overrun,
      severity: overrun?.severity ?? budget.overrunSeverity,
    };
  });
}
