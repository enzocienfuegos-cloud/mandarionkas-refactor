import type {
  PacingAlert,
  PacingCampaign,
  PacingRow,
  PacingStatus,
  PrioritySeverity,
  RawPacingStatus,
  SpendView,
} from './types';
import { applySpendView, deriveSpendMetrics, type CostMetadata } from '../../shared/costing';

export const BREAKDOWN_RANGES = [7, 14, 30, 60];

export function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

export function fmtCurrency(value: number): string {
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function normalizePacingCampaign(raw: any): PacingCampaign {
  const pacing = raw?.pacing ?? {};
  const metadata = raw?.metadata ?? {};
  return {
    id: String(raw?.id ?? ''),
    name: String(raw?.name ?? 'Untitled campaign'),
    advertiser: String(raw?.advertiser ?? raw?.advertiserName ?? '—'),
    status: (raw?.status ?? pacing?.status ?? 'no_goal') as RawPacingStatus,
    pacingPct: Number(raw?.pacingPct ?? pacing?.pacingPct ?? 0) || 0,
    deliveryPct: Number(raw?.deliveryPct ?? pacing?.deliveryPct ?? 0) || 0,
    impressionsServed: Number(raw?.impressionsServed ?? raw?.servedTotal ?? pacing?.servedTotal ?? 0) || 0,
    impressionGoal: raw?.impressionGoal ?? pacing?.impressionGoal ?? null,
    remainingDays: Number(raw?.remainingDays ?? pacing?.remainingDays ?? 0) || 0,
    startDate: String(raw?.startDate ?? ''),
    endDate: String(raw?.endDate ?? ''),
    budget: raw?.budget ?? null,
    dailyBudget: raw?.dailyBudget ?? raw?.daily_budget ?? null,
    estimatedRate: metadata?.estimatedRate ?? raw?.estimatedRate ?? null,
    markupPercent: metadata?.markupPercent ?? raw?.markupPercent ?? null,
    servingFeeCpm: metadata?.servingFeeCpm ?? raw?.servingFeeCpm ?? null,
    servingCostMode: metadata?.servingCostMode ?? raw?.servingCostMode ?? 'paid',
  };
}

export function normalizePacingAlert(raw: any): PacingAlert {
  const campaign = normalizePacingCampaign(raw);
  const severity = campaign.status === 'behind' ? 'critical' : 'warning';
  const message =
    raw?.message ??
    (campaign.status === 'behind'
      ? `Delivery is behind expected pacing at ${campaign.pacingPct.toFixed(1)}%.`
      : `Campaign has ${campaign.remainingDays} day(s) left and ${campaign.deliveryPct.toFixed(1)}% delivered.`);
  return {
    campaignId: campaign.id,
    campaignName: campaign.name,
    status: campaign.status,
    message,
    severity,
  };
}

export function rawStatusToDenseStatus(status: RawPacingStatus): PacingStatus {
  switch (status) {
    case 'on_track':
      return 'On pace';
    case 'behind':
      return 'Underpacing';
    case 'ahead':
      return 'Overpacing';
    case 'completed':
    case 'no_goal':
      return 'On pace';
    case 'not_started':
    default:
      return 'Paused';
  }
}

export function getRiskFromStatus(status: RawPacingStatus): PrioritySeverity {
  switch (status) {
    case 'behind':
    case 'not_started':
      return 'Critical';
    case 'ahead':
      return 'Warning';
    default:
      return 'Notice';
  }
}

function getBudgetValue(campaign: PacingCampaign): number {
  const lifetimeBudget = Number(campaign.budget ?? 0) || 0;
  if (lifetimeBudget > 0) return lifetimeBudget;
  const dailyBudget = Number(campaign.dailyBudget ?? 0) || 0;
  if (dailyBudget <= 0) return 0;
  const totalDays = Math.max(Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000) + 1, 1);
  return dailyBudget * totalDays;
}

function getCostMetadata(campaign: PacingCampaign): CostMetadata {
  return {
    estimatedRate: campaign.estimatedRate,
    markupPercent: campaign.markupPercent,
    servingFeeCpm: campaign.servingFeeCpm,
    servingCostMode: campaign.servingCostMode,
  };
}

function getSpendComponents(campaign: PacingCampaign) {
  return deriveSpendMetrics({
    impressions: campaign.impressionsServed,
    metadata: getCostMetadata(campaign),
    fallbackBudget: getBudgetValue(campaign),
    impressionGoal: campaign.impressionGoal,
  });
}

function getBudgetViewValue(campaign: PacingCampaign, spendView: SpendView) {
  return applySpendView(getBudgetValue(campaign), getCostMetadata(campaign), spendView);
}

function getSpendValue(campaign: PacingCampaign, spendView: SpendView): number {
  const spend = getSpendComponents(campaign);
  return spendView === 'with_margin' ? spend.spendWithMargin : spend.spendWithoutMargin;
}

function getProjectedValue(campaign: PacingCampaign, spendView: SpendView): number {
  const budget = getBudgetValue(campaign);
  if (budget > 0) {
    return applySpendView(budget * Math.max(campaign.deliveryPct, 0) / 100, getCostMetadata(campaign), spendView);
  }
  const projectedImpressions = campaign.impressionGoal
    ? (campaign.impressionGoal * Math.max(campaign.deliveryPct, 0)) / 100
    : campaign.impressionsServed;
  const projectedSpend = deriveSpendMetrics({
    impressions: projectedImpressions,
    metadata: getCostMetadata(campaign),
    impressionGoal: campaign.impressionGoal,
  });
  return spendView === 'with_margin' ? projectedSpend.spendWithMargin : projectedSpend.spendWithoutMargin;
}

function getDailyTargetValue(campaign: PacingCampaign, spendView: SpendView): number {
  const dailyBudget = Number(campaign.dailyBudget ?? 0) || 0;
  if (dailyBudget > 0) return applySpendView(dailyBudget, getCostMetadata(campaign), spendView);
  const budget = getBudgetValue(campaign);
  if (budget <= 0) return 0;
  const totalDays = Math.max(Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000) + 1, 1);
  return applySpendView(budget / totalDays, getCostMetadata(campaign), spendView);
}

export function buildPacingRow(campaign: PacingCampaign, spendView: SpendView = 'without_margin'): PacingRow {
  const spend = getSpendValue(campaign, spendView);
  const budget = getBudgetViewValue(campaign, spendView);
  const projected = getProjectedValue(campaign, spendView);
  const dailyTarget = getDailyTargetValue(campaign, spendView);
  return {
    id: campaign.id,
    campaign: campaign.name,
    advertiser: campaign.advertiser,
    status: rawStatusToDenseStatus(campaign.status),
    pacing: `${Math.round(campaign.deliveryPct)}%`,
    pacingPct: campaign.deliveryPct,
    spend: fmtCurrency(spend),
    spendValue: spend,
    budget: fmtCurrency(budget),
    budgetValue: budget,
    dailyTarget: fmtCurrency(dailyTarget),
    dailyTargetValue: dailyTarget,
    projected: fmtCurrency(projected),
    projectedValue: projected,
    risk: getRiskFromStatus(campaign.status),
    owner: campaign.advertiser === '—' ? 'Ad Ops' : campaign.advertiser,
  };
}
