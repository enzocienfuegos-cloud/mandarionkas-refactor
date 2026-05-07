import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, Modal, TrendChart } from '../../system';
import type { BreakdownDay, PacingCampaign } from './types';
import { BREAKDOWN_RANGES, fmtNum } from './utils';

export function SparklineModal({ campaign, onClose }: { campaign: PacingCampaign; onClose: () => void }) {
  const [days, setDays] = useState(14);
  const [breakdown, setBreakdown] = useState<BreakdownDay[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    fetch(`/v1/pacing/${campaign.id}/breakdown?days=${days}`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Failed to load breakdown');
        return response.json();
      })
      .then((payload) => setBreakdown(payload?.breakdown ?? payload ?? []))
      .catch((breakdownError: Error) => setError(breakdownError.message))
      .finally(() => setLoading(false));
  }, [campaign.id, days]);

  const chartData = breakdown.map((entry) => ({
    date: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    actual: entry.impressions,
    expected: entry.expected,
  }));

  return (
    <Modal open onClose={onClose} title={campaign.name} description={`${campaign.advertiser} · Daily breakdown`}>
      <div className="space-y-5">
        <div className="flex gap-2">
          {BREAKDOWN_RANGES.map((range) => (
            <Button
              key={range}
              onClick={() => setDays(range)}
              variant={days === range ? 'primary' : 'secondary'}
              size="sm"
            >
              {range}d
            </Button>
          ))}
        </div>

        {error ? (
          <div className="rounded-lg border border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-3 py-2 text-sm text-[color:var(--dusk-status-critical-fg)]">
            {error}
          </div>
        ) : null}

        {loading ? (
          <CenteredSpinner label="Loading pacing breakdown…" />
        ) : breakdown.length === 0 ? (
          <div className="py-12 text-center text-sm text-[color:var(--dusk-text-soft)]">No data for this period</div>
        ) : (
          <TrendChart
            data={chartData}
            xKey="date"
            kind="bar"
            title={`Pacing breakdown for ${campaign.name}`}
            description="Bar chart comparing actual delivered impressions and expected impressions for the selected campaign."
            series={[
              { key: 'actual', label: 'Actual', tone: 'brand', format: (value) => fmtNum(value) },
              { key: 'expected', label: 'Expected', tone: 'info', format: (value) => fmtNum(value) },
            ]}
          />
        )}

        <div className="grid grid-cols-3 gap-3 border-t border-[color:var(--dusk-border-subtle)] pt-4">
          <div className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Delivery</p>
            <p className="text-lg font-bold text-[color:var(--dusk-brand-fg)]">{campaign.deliveryPct.toFixed(1)}%</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Served</p>
            <p className="text-lg font-bold text-[color:var(--dusk-text-primary)]">{fmtNum(campaign.impressionsServed)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Days Left</p>
            <p className="text-lg font-bold text-[color:var(--dusk-text-primary)]">{campaign.remainingDays}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
