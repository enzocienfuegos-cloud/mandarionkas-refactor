import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Eye,
  MousePointerClick,
  TrendingUp,
  Activity,
  Megaphone,
  AlertTriangle,
  ArrowRight,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Badge,
  Kicker,
  MetricCard,
  EmptyState,
  Skeleton,
  CenteredSpinner,
  useToast,
} from '../system';

interface OverviewMetrics {
  impressions:   { value: number; delta: number; series: number[] };
  clicks:        { value: number; delta: number; series: number[] };
  ctr:           { value: number; delta: number; series: number[] };
  fillRate:      { value: number; delta: number; series: number[] };
  activeCampaigns: number;
  pendingApprovals: number;
  pacingAlerts: number;
  discrepancyAlerts: number;
}

interface CampaignSummary {
  id: string;
  name: string;
  client: string;
  impressions: number;
  pacing: number; // 0..1
  status: 'on-track' | 'behind' | 'ahead' | 'paused';
}

const PACING_TONE: Record<CampaignSummary['status'], 'success' | 'warning' | 'info' | 'neutral'> = {
  'on-track': 'success',
  'behind':   'warning',
  'ahead':    'info',
  'paused':   'neutral',
};

/**
 * Ad-ops overview — refactored to the design system (S56).
 *
 * What this fixes vs the legacy version (1,100 lines):
 *   - 4 inline MetricCard implementations replaced with the system one.
 *   - Inline Sparkline replaced with the system one.
 *   - Hardcoded brand-gradient buttons replaced with <Button variant="primary">.
 *   - Per-page workspace selector removed (lives in TopBar now).
 *   - Hardcoded "campaign focus" decoration removed.
 *   - All data is shaped by the API, no fake counts.
 */
export default function AdOpsOverview() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [metrics, setMetrics]     = useState<OverviewMetrics | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([
      fetch('/v1/overview/metrics',          { credentials: 'include' }).then((r) => r.json()),
      fetch('/v1/overview/campaigns?limit=6', { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([metricsData, campaignsData]) => {
        if (cancelled) return;
        setMetrics(metricsData?.metrics ?? metricsData);
        setCampaigns(campaignsData?.items ?? []);
      })
      .catch(() => toast({ tone: 'critical', title: 'Could not load overview' }))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [toast]);

  const queueCounts = useMemo(
    () => ({
      pending:       metrics?.pendingApprovals  ?? 0,
      pacing:        metrics?.pacingAlerts      ?? 0,
      discrepancies: metrics?.discrepancyAlerts ?? 0,
    }),
    [metrics],
  );

  return (
    <div className="space-y-6">
      <header className="dusk-page-header">
        <div>
          <Kicker>Operations</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Overview
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Performance across the workspace, last 7 days.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => navigate('/reporting')}>
            Open reporting
          </Button>
          <Button variant="primary" leadingIcon={<Megaphone />} onClick={() => navigate('/campaigns/new')}>
            New campaign
          </Button>
        </div>
      </header>

      {/* Key metrics — single MetricCard component, no duplication */}
      {loading ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <MetricCard key={i} label="" value="" loading />
          ))}
        </div>
      ) : metrics ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Impressions"
            value={formatCompact(metrics.impressions.value)}
            delta={formatPct(metrics.impressions.delta)}
            trend={trendOf(metrics.impressions.delta)}
            series={metrics.impressions.series}
            tone="brand"
            icon={<Eye />}
            onClick={() => navigate('/reporting?metric=impressions')}
          />
          <MetricCard
            label="Clicks"
            value={formatCompact(metrics.clicks.value)}
            delta={formatPct(metrics.clicks.delta)}
            trend={trendOf(metrics.clicks.delta)}
            series={metrics.clicks.series}
            tone="info"
            icon={<MousePointerClick />}
            onClick={() => navigate('/reporting?metric=clicks')}
          />
          <MetricCard
            label="CTR"
            value={`${(metrics.ctr.value * 100).toFixed(2)}%`}
            delta={formatPct(metrics.ctr.delta)}
            trend={trendOf(metrics.ctr.delta)}
            series={metrics.ctr.series}
            tone="success"
            icon={<TrendingUp />}
            onClick={() => navigate('/reporting?metric=ctr')}
          />
          <MetricCard
            label="Fill rate"
            value={`${(metrics.fillRate.value * 100).toFixed(1)}%`}
            delta={formatPct(metrics.fillRate.delta)}
            trend={trendOf(metrics.fillRate.delta)}
            series={metrics.fillRate.series}
            tone="neutral"
            icon={<Activity />}
          />
        </div>
      ) : null}

      {/* Two-column: queues + recent campaigns */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Queues — actionable counts */}
        <Panel padding="lg" className="lg:col-span-1">
          <PanelHeader title="Queues" subtitle="What needs attention" />
          <div className="space-y-2">
            <QueueRow
              icon={<Eye />}
              label="Creative approvals"
              count={queueCounts.pending}
              tone="warning"
              onClick={() => navigate('/creatives/approval')}
            />
            <QueueRow
              icon={<Activity />}
              label="Pacing alerts"
              count={queueCounts.pacing}
              tone="critical"
              onClick={() => navigate('/pacing')}
            />
            <QueueRow
              icon={<AlertTriangle />}
              label="Discrepancies"
              count={queueCounts.discrepancies}
              tone="warning"
              onClick={() => navigate('/discrepancies')}
            />
          </div>
        </Panel>

        {/* Recent campaigns */}
        <Panel padding="lg" className="lg:col-span-2">
          <PanelHeader
            title="Top campaigns"
            subtitle="Highest impression volume in the last 24h"
            actions={
              <Button variant="ghost" size="sm" trailingIcon={<ArrowRight />} onClick={() => navigate('/campaigns')}>
                See all
              </Button>
            }
          />

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <EmptyState
              icon={<Megaphone />}
              title="No active campaigns"
              description="Create your first campaign to start trafficking creatives."
              action={
                <Button variant="primary" leadingIcon={<Megaphone />} onClick={() => navigate('/campaigns/new')}>
                  New campaign
                </Button>
              }
            />
          ) : (
            <ul className="space-y-1">
              {campaigns.map((campaign) => (
                <li key={campaign.id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/campaigns/${campaign.id}`)}
                    className="w-full flex items-center justify-between gap-3 p-3 rounded-lg text-left hover:bg-[color:var(--dusk-surface-hover)] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[color:var(--dusk-text-primary)] truncate">
                        {campaign.name}
                      </p>
                      <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">
                        {campaign.client} · {formatCompact(campaign.impressions)} imps
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <PacingBar pacing={campaign.pacing} />
                      <Badge tone={PACING_TONE[campaign.status]} size="sm">
                        {campaign.status}
                      </Badge>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function QueueRow({
  icon,
  label,
  count,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: 'warning' | 'critical' | 'info';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between gap-3 p-3 rounded-lg hover:bg-[color:var(--dusk-surface-hover)] transition-colors text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4 text-[color:var(--dusk-text-muted)]">
          {icon}
        </span>
        <p className="text-sm text-[color:var(--dusk-text-primary)] truncate">{label}</p>
      </div>
      {count > 0 ? (
        <Badge tone={tone} size="sm" variant="solid">{count}</Badge>
      ) : (
        <span className="text-xs text-[color:var(--dusk-text-soft)]">none</span>
      )}
    </button>
  );
}

function PacingBar({ pacing }: { pacing: number }) {
  // Pacing 0..1 — 1.0 means on goal. Below 0.85 = behind, above 1.15 = ahead.
  const clamped = Math.min(1.5, Math.max(0, pacing));
  const pct = Math.round(clamped * 100);
  const tone =
    pacing < 0.85 ? 'var(--dusk-status-warning-fg)' :
    pacing > 1.15 ? 'var(--dusk-status-info-fg)' :
                    'var(--dusk-status-success-fg)';

  return (
    <div className="hidden sm:flex flex-col items-end gap-1">
      <span className="text-[10px] uppercase tracking-kicker text-[color:var(--dusk-text-soft)] tabular">
        {pct}%
      </span>
      <div className="h-1 w-20 rounded-full bg-[color:var(--dusk-surface-muted)] overflow-hidden">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${Math.min(100, pct)}%`, background: tone }}
        />
      </div>
    </div>
  );
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPct(delta: number): string {
  const sign = delta > 0 ? '+' : '';
  return `${sign}${(delta * 100).toFixed(1)}%`;
}

function trendOf(delta: number): 'up' | 'down' | 'flat' {
  if (delta > 0.005) return 'up';
  if (delta < -0.005) return 'down';
  return 'flat';
}
