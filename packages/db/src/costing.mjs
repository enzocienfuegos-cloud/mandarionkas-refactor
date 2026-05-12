function toFiniteNumber(value) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function roundCurrency(value) {
  return Number(toFiniteNumber(value).toFixed(4));
}

export function normalizeCostMetadata(metadata = {}) {
  return metadata && typeof metadata === 'object' ? metadata : {};
}

export function deriveSpendMetrics({
  impressions = 0,
  recordedSpend = 0,
  metadata = {},
  fallbackBudget = 0,
  impressionGoal = 0,
} = {}) {
  const normalizedMetadata = normalizeCostMetadata(metadata);
  const deliveredImpressions = Math.max(toFiniteNumber(impressions), 0);
  const deliveredThousands = deliveredImpressions / 1000;
  const estimatedRate = Math.max(toFiniteNumber(normalizedMetadata.estimatedRate), 0);
  const servingFeeCpm = normalizedMetadata.servingCostMode === 'free'
    ? 0
    : Math.max(toFiniteNumber(normalizedMetadata.servingFeeCpm), 0);
  const markupPercent = Math.max(toFiniteNumber(normalizedMetadata.markupPercent), 0);
  const normalizedRecordedSpend = Math.max(toFiniteNumber(recordedSpend), 0);
  const normalizedBudget = Math.max(toFiniteNumber(fallbackBudget), 0);
  const normalizedGoal = Math.max(toFiniteNumber(impressionGoal), 0);

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
