import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, Drawer, Kicker, Panel, TrendChart } from '../../system';
import type { BreakdownDay, PacingCampaign } from './types';
import { BREAKDOWN_RANGES, fmtNum } from './utils';

export function CampaignDetailDrawer({
  campaign,
  open,
  onClose,
}: {
  campaign: PacingCampaign | null;
  open: boolean;
  onClose: () => void;
}) {
  const [days, setDays] = useState(14);
  const [breakdown, setBreakdown] = useState<BreakdownDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !campaign) return;
    setLoading(true);
    setError('');
    fetch(`/v1/pacing/${campaign.id}/breakdown?days=${days}`, { credentials: 'include' })
      .then((response) => {
        if (!response.ok) throw new Error('Unable to load pacing detail for this campaign.');
        return response.json();
      })
      .then((payload) => setBreakdown(payload?.breakdown ?? payload ?? []))
      .catch((breakdownError: Error) => setError(breakdownError.message))
      .finally(() => setLoading(false));
  }, [campaign, days, open]);

  if (!campaign) return null;

  const chartData = breakdown.map((entry) => ({
    date: new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    actual: entry.impressions,
    expected: entry.expected,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={campaign.name}
      subtitle={`${campaign.advertiser} · ${campaign.remainingDays} day(s) remaining`}
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap gap-2">
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
          <Panel className="border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-4 py-3 text-sm text-[color:var(--dusk-status-critical-fg)]">
            {error}
          </Panel>
        ) : null}

        {loading ? (
          <CenteredSpinner label="Loading pacing breakdown…" />
        ) : breakdown.length === 0 ? (
          <Panel className="px-6 py-10 text-center">
            <Kicker>No trend data</Kicker>
            <p className="mt-2 text-sm text-[color:var(--dusk-text-muted)]">
              This campaign has no pacing breakdown for the selected window yet.
            </p>
          </Panel>
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
          <Panel padding="sm" className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Delivery</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-brand-fg)]">{campaign.deliveryPct.toFixed(1)}%</p>
          </Panel>
          <Panel padding="sm" className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Served</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-text-primary)]">{fmtNum(campaign.impressionsServed)}</p>
          </Panel>
          <Panel padding="sm" className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Days left</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-text-primary)]">{campaign.remainingDays}</p>
          </Panel>
        </div>
      </div>
    </Drawer>
  );
}
