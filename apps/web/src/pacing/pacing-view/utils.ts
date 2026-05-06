import type {
  PacingAlert,
  PacingCampaign,
  PacingRow,
  PacingStatus,
  PrioritySeverity,
  RawPacingStatus,
} from './types';

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
  return campaign.impressionGoal ? campaign.impressionGoal / 1000 : 0;
}

function getSpendValue(campaign: PacingCampaign): number {
  return campaign.impressionsServed / 1000;
}

function getProjectedValue(campaign: PacingCampaign): number {
  if (!campaign.impressionGoal) return 0;
  const projected = (campaign.impressionGoal * Math.max(campaign.deliveryPct, 0)) / 100;
  return projected / 1000;
}

function getDailyTargetValue(campaign: PacingCampaign): number {
  if (!campaign.impressionGoal) return 0;
  const totalDays = Math.max(Math.ceil((new Date(campaign.endDate).getTime() - new Date(campaign.startDate).getTime()) / 86400000), 1);
  return campaign.impressionGoal / totalDays / 1000;
}

export function buildPacingRow(campaign: PacingCampaign): PacingRow {
  const spend = getSpendValue(campaign);
  const budget = getBudgetValue(campaign);
  const projected = getProjectedValue(campaign);
  const dailyTarget = getDailyTargetValue(campaign);
  return {
    id: campaign.id,
    campaign: campaign.name,
    advertiser: campaign.advertiser,
    status: rawStatusToDenseStatus(campaign.status),
    pacing: `${Math.round(campaign.deliveryPct)}%`,
    spend: fmtCurrency(spend),
    budget: fmtCurrency(budget),
    dailyTarget: fmtCurrency(dailyTarget),
    projected: fmtCurrency(projected),
    risk: getRiskFromStatus(campaign.status),
    owner: campaign.advertiser === '—' ? 'Ad Ops' : campaign.advertiser,
  };
}
