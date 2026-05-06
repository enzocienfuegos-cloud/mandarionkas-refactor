import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Download,
  Filter as FilterIcon,
  Calendar,
  TrendingUp,
} from '../system/icons';
import {
  Panel,
  PanelHeader,
  Button,
  Select,
  Badge,
  Kicker,
  MetricCard,
  DataTable,
  type ColumnDef,
  EmptyState,
  Tabs,
  TabsList,
  Tab,
  TabPanel,
  TrendChart,
  type TrendSeries,
  useToast,
} from '../system';

type DateRange = '24h' | '7d' | '30d' | 'qtd' | 'ytd' | 'custom';
type Granularity = 'hour' | 'day' | 'week' | 'month';

interface ReportRow {
  date: string;        // ISO
  campaignId: string;
  campaignName: string;
  client: string;
  impressions: number;
  clicks: number;
  ctr: number;
  spend: number;
  conversions: number;
  cpa: number | null;
}

interface ReportSummary {
  impressions: { value: number; delta: number; series: number[] };
  clicks:      { value: number; delta: number; series: number[] };
  spend:       { value: number; delta: number; series: number[] };
  conversions: { value: number; delta: number; series: number[] };
  ctr:         { value: number; delta: number };
  cpa:         { value: number; delta: number };
}

const DATE_RANGE_OPTIONS = [
  { value: '24h', label: 'Last 24 hours' },
  { value: '7d',  label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
];

const GRANULARITY_OPTIONS = [
  { value: 'hour',  label: 'By hour' },
  { value: 'day',   label: 'By day' },
  { value: 'week',  label: 'By week' },
  { value: 'month', label: 'By month' },
];

/**
 * Reporting — refactored to the design system (S56).
 *
 * Replaces the legacy reporting page which:
 *   - Had 3 inline MetricCard implementations (one per metric tab)
 *   - Used a hand-rolled <table> with custom sort/filter logic
 *   - Hardcoded date-range pickers per tab
 *   - Inline loading skeletons
 *
 * The chart container is left as a tokenized Panel — wire your existing
 * chart lib (recharts / chart.js / d3) inside without further changes.
 */
export default function Reporting() {
  const { toast } = useToast();

  const [range, setRange]     = useState<DateRange>('7d');
  const [granularity, setGranularity] = useState<Granularity>('day');
  const [tab, setTab]         = useState<'performance' | 'attribution' | 'placements'>('performance');
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [rows, setRows]       = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams({ range, granularity });
    Promise.all([
      fetch(`/v1/reporting/summary?${params}`,  { credentials: 'include' }).then((r) => r.json()),
      fetch(`/v1/reporting/breakdown?${params}`, { credentials: 'include' }).then((r) => r.json()),
    ])
      .then(([summaryData, rowsData]) => {
        if (cancelled) return;
        setSummary(summaryData?.summary ?? summaryData);
        setRows(rowsData?.items ?? []);
      })
      .catch(() => toast({ tone: 'critical', title: 'Could not load report' }))
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [range, granularity, toast]);

  const handleExport = async () => {
    try {
      const params = new URLSearchParams({ range, granularity, format: 'csv' });
      const res = await fetch(`/v1/reporting/export?${params}`, { credentials: 'include' });
      if (!res.ok) throw new Error('export failed');
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ tone: 'success', title: 'Report exported' });
    } catch {
      toast({ tone: 'critical', title: 'Export failed' });
    }
  };

  const columns = useMemo(() => buildColumns(granularity), [granularity]);
  const trendData = useMemo(() => {
    if (!summary) return [];
    const len = Math.min(
      summary.impressions.series.length,
      summary.clicks.series.length,
    );
    const points: { date: string; impressions: number; clicks: number }[] = [];
    const now = new Date();
    for (let i = 0; i < len; i += 1) {
      const offset = len - 1 - i;
      const date = bucketDate(now, granularity, offset);
      points.push({
        date,
        impressions: summary.impressions.series[i] ?? 0,
        clicks: summary.clicks.series[i] ?? 0,
      });
    }
    return points;
  }, [summary, granularity]);

  const trendSeries: TrendSeries[] = useMemo(
    () => [
      {
        key: 'impressions',
        label: 'Impressions',
        tone: 'brand',
        format: (v) => v.toLocaleString(),
      },
      {
        key: 'clicks',
        label: 'Clicks',
        tone: 'info',
        format: (v) => v.toLocaleString(),
      },
    ],
    [],
  );

  return (
    <div className="space-y-5">
      <header className="dusk-page-header">
        <div>
          <Kicker>Reporting</Kicker>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[color:var(--dusk-text-primary)]">
            Performance reporting
          </h1>
          <p className="mt-1 text-sm text-[color:var(--dusk-text-muted)]">
            Cross-campaign delivery, conversions and attribution.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            selectSize="md"
            value={range}
            onChange={(e) => setRange(e.target.value as DateRange)}
            options={DATE_RANGE_OPTIONS}
            fullWidth={false}
            className="min-w-[180px]"
          />
          <Select
            selectSize="md"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as Granularity)}
            options={GRANULARITY_OPTIONS}
            fullWidth={false}
            className="min-w-[140px]"
          />
          <Button variant="ghost" leadingIcon={<FilterIcon />}>Filters</Button>
          <Button variant="secondary" leadingIcon={<Download />} onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </header>

      {/* Summary metrics */}
      <div className="grid gap-4 grid-cols-2 xl:grid-cols-6">
        <MetricCard
          label="Impressions"
          value={loading || !summary ? '' : formatCompact(summary.impressions.value)}
          delta={summary ? formatPct(summary.impressions.delta) : undefined}
          trend={summary ? trendOf(summary.impressions.delta) : undefined}
          series={summary?.impressions.series}
          tone="brand"
          loading={loading}
        />
        <MetricCard
          label="Clicks"
          value={loading || !summary ? '' : formatCompact(summary.clicks.value)}
          delta={summary ? formatPct(summary.clicks.delta) : undefined}
          trend={summary ? trendOf(summary.clicks.delta) : undefined}
          series={summary?.clicks.series}
          tone="info"
          loading={loading}
        />
        <MetricCard
          label="CTR"
          value={loading || !summary ? '' : `${(summary.ctr.value * 100).toFixed(2)}%`}
          delta={summary ? formatPct(summary.ctr.delta) : undefined}
          trend={summary ? trendOf(summary.ctr.delta) : undefined}
          tone="success"
          loading={loading}
        />
        <MetricCard
          label="Spend"
          value={loading || !summary ? '' : formatCurrency(summary.spend.value)}
          delta={summary ? formatPct(summary.spend.delta) : undefined}
          trend={summary ? trendOf(summary.spend.delta) : undefined}
          series={summary?.spend.series}
          tone="neutral"
          loading={loading}
        />
        <MetricCard
          label="Conversions"
          value={loading || !summary ? '' : formatCompact(summary.conversions.value)}
          delta={summary ? formatPct(summary.conversions.delta) : undefined}
          trend={summary ? trendOf(summary.conversions.delta) : undefined}
          series={summary?.conversions.series}
          tone="success"
          loading={loading}
        />
        <MetricCard
          label="CPA"
          value={loading || !summary || summary.cpa.value === 0 ? '' : formatCurrency(summary.cpa.value)}
          delta={summary ? formatPct(summary.cpa.delta) : undefined}
          trend={summary ? trendOf(-summary.cpa.delta) : undefined /* lower is better */}
          tone="warning"
          loading={loading}
        />
      </div>

      {/* Tabs for different views */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList aria-label="Report views">
          <Tab value="performance" leadingIcon={<TrendingUp className="h-4 w-4" />}>Performance</Tab>
          <Tab value="attribution" leadingIcon={<BarChart3 className="h-4 w-4" />}>Attribution</Tab>
          <Tab value="placements"  leadingIcon={<FilterIcon className="h-4 w-4" />}>Placements</Tab>
        </TabsList>

        <TabPanel value="performance">
          <Panel padding="lg">
            <PanelHeader
              title="Trend"
              subtitle="Performance over the selected window"
              kicker={<span className="inline-flex items-center gap-1.5"><Calendar className="h-3 w-3" />{rangeLabel(range)}</span>}
            />
            {loading ? (
              <div
                className="rounded-lg border border-[color:var(--dusk-border-subtle)] bg-[color:var(--dusk-surface-muted)] animate-pulse"
                style={{ height: 280 }}
              />
            ) : trendData.length === 0 ? (
              <EmptyState
                icon={<BarChart3 />}
                title="No trend data"
                description="No delivery in this range. Try expanding the window or check campaign status."
              />
            ) : (
              <TrendChart
                data={trendData}
                xKey="date"
                xFormat={(v) => formatXLabel(v as string, granularity)}
                kind="area"
                series={trendSeries}
                height={280}
              />
            )}
          </Panel>

          <Panel padding="none" className="mt-4">
            <PanelHeader title="Breakdown" subtitle="By campaign" className="px-6 pt-6" />
            {!loading && rows.length === 0 ? (
              <EmptyState
                icon={<BarChart3 />}
                title="No data for the selected range"
                description="Try expanding the date range or check if any campaigns are live."
              />
            ) : (
              <DataTable
                columns={columns}
                data={rows}
                rowKey={(r) => `${r.campaignId}-${r.date}`}
                loading={loading}
                density="comfortable"
                bordered={false}
              />
            )}
          </Panel>
        </TabPanel>

        <TabPanel value="attribution">
          <Panel padding="lg">
            <PanelHeader title="Attribution" subtitle="Conversions and assist paths" />
            <EmptyState
              icon={<BarChart3 />}
              title="Attribution view"
              description="Wire your attribution model output here. The container is already on tokens."
            />
          </Panel>
        </TabPanel>

        <TabPanel value="placements">
          <Panel padding="lg">
            <PanelHeader title="Placements" subtitle="Top performing inventory" />
            <EmptyState
              icon={<FilterIcon />}
              title="Placement breakdown"
              description="Wire your placement-level breakdown query here."
            />
          </Panel>
        </TabPanel>
      </Tabs>
    </div>
  );
}

function buildColumns(granularity: Granularity): ColumnDef<ReportRow>[] {
  return [
    {
      id: 'date',
      header: granularity === 'hour' ? 'Hour' : 'Date',
      sortAccessor: (row) => row.date,
      cell: (row) => (
        <span className="dusk-mono text-xs text-[color:var(--dusk-text-secondary)]">
          {granularity === 'hour'
            ? new Date(row.date).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
            : new Date(row.date).toLocaleDateString()}
        </span>
      ),
    },
    {
      id: 'campaign',
      header: 'Campaign',
      sortAccessor: (row) => row.campaignName,
      cell: (row) => (
        <div className="min-w-0">
          <p className="font-medium text-[color:var(--dusk-text-primary)] truncate">{row.campaignName}</p>
          <p className="mt-0.5 text-xs text-[color:var(--dusk-text-soft)] truncate">{row.client}</p>
        </div>
      ),
      width: '24%',
    },
    {
      id: 'imps',
      header: 'Impressions',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.impressions,
      cell: (row) => row.impressions.toLocaleString(),
    },
    {
      id: 'clicks',
      header: 'Clicks',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.clicks,
      cell: (row) => row.clicks.toLocaleString(),
    },
    {
      id: 'ctr',
      header: 'CTR',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.ctr,
      cell: (row) => `${(row.ctr * 100).toFixed(2)}%`,
    },
    {
      id: 'spend',
      header: 'Spend',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.spend,
      cell: (row) => formatCurrency(row.spend),
    },
    {
      id: 'conv',
      header: 'Conversions',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.conversions,
      cell: (row) => row.conversions.toLocaleString(),
    },
    {
      id: 'cpa',
      header: 'CPA',
      align: 'right',
      numeric: true,
      sortAccessor: (row) => row.cpa ?? Number.MAX_SAFE_INTEGER,
      cell: (row) => (row.cpa != null ? formatCurrency(row.cpa) : '—'),
    },
  ];
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000)     return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value < 10 ? 2 : 0,
  }).format(value);
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

function rangeLabel(range: DateRange): string {
  const opt = DATE_RANGE_OPTIONS.find((o) => o.value === range);
  return opt?.label ?? range;
}

function bucketDate(now: Date, granularity: Granularity, offset: number): string {
  const d = new Date(now);
  switch (granularity) {
    case 'hour':
      d.setHours(d.getHours() - offset, 0, 0, 0);
      break;
    case 'day':
      d.setDate(d.getDate() - offset);
      d.setHours(0, 0, 0, 0);
      break;
    case 'week':
      d.setDate(d.getDate() - offset * 7);
      d.setHours(0, 0, 0, 0);
      break;
    case 'month':
      d.setMonth(d.getMonth() - offset, 1);
      d.setHours(0, 0, 0, 0);
      break;
  }
  return d.toISOString();
}

function formatXLabel(iso: string, granularity: Granularity): string {
  const date = new Date(iso);
  switch (granularity) {
    case 'hour':
      return date.toLocaleTimeString(undefined, { hour: 'numeric' });
    case 'month':
      return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
    case 'week':
    case 'day':
    default:
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
}
