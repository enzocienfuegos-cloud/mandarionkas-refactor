import React, { useEffect, useState } from 'react';
import { Button, CenteredSpinner, Modal } from '../../system';
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

  const maxVal = Math.max(...breakdown.map((entry) => Math.max(entry.impressions, entry.expected)), 1);
  const W = 560;
  const H = 120;
  const PAD = { l: 44, r: 10, t: 10, b: 28 };
  const chartW = W - PAD.l - PAD.r;
  const chartH = H - PAD.t - PAD.b;
  const barW = breakdown.length > 0 ? Math.max(2, chartW / breakdown.length - 2) : 0;

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
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="mb-1 w-full" style={{ height: H }}>
              <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />
              <line x1={PAD.l} y1={PAD.t + chartH} x2={PAD.l + chartW} y2={PAD.t + chartH} stroke="#e2e8f0" strokeWidth="1" />
              {[0, 0.5, 1].map((fraction) => {
                const y = PAD.t + chartH - fraction * chartH;
                const value = Math.round(maxVal * fraction);
                return (
                  <g key={fraction}>
                    <line x1={PAD.l} y1={y} x2={PAD.l + chartW} y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x={PAD.l - 4} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                      {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                    </text>
                  </g>
                );
              })}

              {breakdown.map((entry, index) => {
                const slotW = chartW / breakdown.length;
                const x = PAD.l + index * slotW;
                const barHeight = (entry.impressions / maxVal) * chartH;
                const expectedHeight = (entry.expected / maxVal) * chartH;
                return (
                  <g key={entry.date}>
                    <rect x={x + slotW * 0.5} y={PAD.t + chartH - expectedHeight} width={barW * 0.45} height={expectedHeight} fill="#e0e7ff" rx="1" />
                    <rect x={x + 1} y={PAD.t + chartH - barHeight} width={barW * 0.45} height={barHeight} fill="#f1008b" rx="1">
                      <title>
                        {entry.date}: {entry.impressions.toLocaleString()} served / {entry.expected.toLocaleString()} expected
                      </title>
                    </rect>
                    {index % Math.ceil(breakdown.length / 7) === 0 && (
                      <text x={x + slotW / 2} y={H - 4} textAnchor="middle" fontSize="8" fill="#94a3b8">
                        {new Date(`${entry.date}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>

            <div className="mb-4 flex gap-4 text-xs text-[color:var(--dusk-text-soft)]">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-fuchsia-500" />
                Actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-sm bg-fuchsia-200 dark:bg-fuchsia-500/30" />
                Expected
              </span>
            </div>
          </>
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
