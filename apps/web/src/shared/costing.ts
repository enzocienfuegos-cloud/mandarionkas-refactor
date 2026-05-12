export type SpendView = 'without_margin' | 'with_margin';

export type CostMetadata = {
  estimatedRate?: number | string | null;
  markupPercent?: number | string | null;
  servingFeeCpm?: number | string | null;
  servingCostMode?: string | null;
};

function toNumber(value: unknown) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCurrency(value: number) {
  return Number(toNumber(value).toFixed(4));
}

export function getMarginMultiplier(metadata: CostMetadata | null | undefined, spendView: SpendView) {
  if (spendView !== 'with_margin') return 1;
  return 1 + Math.max(toNumber(metadata?.markupPercent), 0) / 100;
}

export function applySpendView(value: number, metadata: CostMetadata | null | undefined, spendView: SpendView) {
  return roundCurrency(Math.max(toNumber(value), 0) * getMarginMultiplier(metadata, spendView));
}

export function deriveSpendMetrics({
  impressions = 0,
  recordedSpend = 0,
  metadata = {},
  fallbackBudget = 0,
  impressionGoal = 0,
}: {
  impressions?: number | string | null;
  recordedSpend?: number | string | null;
  metadata?: CostMetadata | null;
  fallbackBudget?: number | string | null;
  impressionGoal?: number | string | null;
} = {}) {
  const deliveredImpressions = Math.max(toNumber(impressions), 0);
  const deliveredThousands = deliveredImpressions / 1000;
  const estimatedRate = Math.max(toNumber(metadata?.estimatedRate), 0);
  const servingFeeCpm = metadata?.servingCostMode === 'free'
    ? 0
    : Math.max(toNumber(metadata?.servingFeeCpm), 0);
  const markupPercent = Math.max(toNumber(metadata?.markupPercent), 0);
  const normalizedRecordedSpend = Math.max(toNumber(recordedSpend), 0);
  const normalizedBudget = Math.max(toNumber(fallbackBudget), 0);
  const normalizedGoal = Math.max(toNumber(impressionGoal), 0);

  let mediaSpend = normalizedRecordedSpend > 0
    ? roundCurrency(normalizedRecordedSpend)
    : roundCurrency(deliveredThousands * estimatedRate);
  if (mediaSpend <= 0 && normalizedBudget > 0 && normalizedGoal > 0 && deliveredImpressions > 0) {
    mediaSpend = roundCurrency(normalizedBudget * Math.min(deliveredImpressions / normalizedGoal, 1));
  }

  const servingFeeSpend = roundCurrency(deliveredThousands * servingFeeCpm);
  const spendWithoutMargin = roundCurrency(mediaSpend + servingFeeSpend);
  const marginSpend = roundCurrency(spendWithoutMargin * (markupPercent / 100));
  const spendWithMargin = roundCurrency(spendWithoutMargin + marginSpend);

  return {
    mediaSpend,
    servingFeeSpend,
    marginSpend,
    spendWithoutMargin,
    spendWithMargin,
  };
}

export function resolveSpendViewValue(
  spend: { spendWithoutMargin: number; spendWithMargin: number },
  spendView: SpendView,
) {
  return spendView === 'with_margin' ? spend.spendWithMargin : spend.spendWithoutMargin;
}
