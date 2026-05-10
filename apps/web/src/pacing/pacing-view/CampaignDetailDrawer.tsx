import { Link } from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { Badge, Button, CenteredSpinner, Drawer, Kicker, Panel, ProgressBar, TrendChart } from '../../system';
import type { BreakdownDay, PacingCampaign } from './types';
import { BREAKDOWN_RANGES, fmtNum, rawStatusToDenseStatus } from './utils';

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
  const deliveredTotal = breakdown.reduce((sum, entry) => sum + Number(entry.impressions ?? 0), 0);
  const targetTotal = breakdown.reduce((sum, entry) => sum + Number(entry.expected ?? 0), 0);
  const projectedTotal = targetTotal > 0
    ? Math.round(targetTotal * (campaign.deliveryPct / 100))
    : 0;
  const statusLabel = rawStatusToDenseStatus(campaign.status);
  const statusTone =
    statusLabel === 'On pace'
      ? 'success'
      : statusLabel === 'Paused'
        ? 'neutral'
        : statusLabel === 'Underpacing'
          ? 'critical'
          : 'warning';

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={campaign.name}
      subtitle={`${campaign.advertiser} · ${campaign.remainingDays} day(s) remaining`}
      footer={(
        <>
          <Link to={`/campaigns/${campaign.id}`} className="inline-flex">
            <Button variant="secondary">View full report</Button>
          </Link>
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </>
      )}
    >
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={statusTone} size="sm">{statusLabel}</Badge>
          <span className="text-sm text-text-muted">{campaign.advertiser}</span>
        </div>

        <Panel padding="sm" className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium text-text-primary">Current pacing</p>
            <span className="dusk-mono text-sm text-text-secondary">{campaign.deliveryPct.toFixed(1)}%</span>
          </div>
          <ProgressBar
            value={campaign.deliveryPct}
            tone="auto"
            thresholds={{ warn: 80, crit: 60 }}
            target={100}
            aria-label={`Current pacing ${campaign.deliveryPct.toFixed(1)} percent`}
          />
        </Panel>

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
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Delivered</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-brand-fg)]">{fmtNum(deliveredTotal)}</p>
          </Panel>
          <Panel padding="sm" className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Target</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-text-primary)]">{fmtNum(targetTotal)}</p>
          </Panel>
          <Panel padding="sm" className="text-center">
            <p className="text-xs text-[color:var(--dusk-text-soft)]">Projected</p>
            <p className="mt-2 text-lg font-bold text-[color:var(--dusk-text-primary)]">{fmtNum(projectedTotal)}</p>
          </Panel>
        </div>
      </div>
    </Drawer>
  );
}
