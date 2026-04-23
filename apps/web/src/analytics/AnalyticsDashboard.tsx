import React, { useEffect, useMemo, useState } from 'react';

type DateRange = 7 | 30 | 90;
type RangeMode = 'preset' | 'custom';
type IdentityTypeFilter = '' | 'external_user_id' | 'device_id' | 'cookie_id';
type IdentitySegmentPreset = '' | 'high_frequency_exposed' | 'clicked_users' | 'engaged_non_clickers';

interface RankedMetric {
  label: string;
  value: number;
  secondary?: string;
}

interface BreakdownItem {
  id?: string;
  label: string;
  secondary?: string;
  tertiary?: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueIdentities?: number;
  avgFrequency?: number;
  viewableImpressions?: number;
  measuredImpressions?: number;
  undeterminedImpressions?: number;
  viewabilityRate?: number;
}

interface VariantItem {
  id: string;
  creativeName: string;
  label: string;
  size: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  uniqueIdentities?: number;
  avgFrequency?: number;
}

interface WorkspaceAnalytics {
  totalImpressions: number;
  totalClicks: number;
  totalSpend: number;
  totalViewableImpressions: number;
  totalMeasuredImpressions: number;
  totalUndeterminedImpressions: number;
  measurableRate: number;
  viewabilityRate: number;
  avgCtr: number;
  totalEngagements: number;
  totalHoverDurationMs: number;
  totalIdentities: number;
  avgIdentityFrequency: number;
  avgIdentityClicks: number;
  activeCampaigns: number;
  activeTags: number;
  totalCreatives: number;
  campaigns: BreakdownItem[];
  tags: BreakdownItem[];
  creatives: BreakdownItem[];
  variants: VariantItem[];
  topSites: RankedMetric[];
  topCountries: RankedMetric[];
  topRegions: RankedMetric[];
  topCities: RankedMetric[];
  topIdentities: RankedMetric[];
  identityFrequency: RankedMetric[];
  identitySegments: RankedMetric[];
  identityKeyBreakdown: RankedMetric[];
  engagements: RankedMetric[];
}

const DATE_RANGES: DateRange[] = [7, 30, 90];
const IDENTITY_FILTERS: Array<{ value: IdentityTypeFilter; label: string }> = [
  { value: '', label: 'All identities' },
  { value: 'external_user_id', label: 'External user ID' },
  { value: 'device_id', label: 'Device ID' },
  { value: 'cookie_id', label: 'Cookie ID' },
];
const IDENTITY_SEGMENT_PRESETS: Array<{ value: IdentitySegmentPreset; label: string }> = [
  { value: '', label: 'Custom audience' },
  { value: 'high_frequency_exposed', label: 'High-frequency exposed' },
  { value: 'clicked_users', label: 'Clicked users' },
  { value: 'engaged_non_clickers', label: 'Engaged non-clickers' },
];

function toNumber(value: unknown): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function fmtNum(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function fmtCtr(value: number): string {
  return `${toNumber(value).toFixed(2)}%`;
}

function formatRange(days: DateRange): string {
  return `${days}d`;
}

function getDateFrom(days: DateRange): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1));
  return date.toISOString().slice(0, 10);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function makeQuery({
  dateRange,
  rangeMode,
  customStartDate,
  customEndDate,
}: {
  dateRange: DateRange;
  rangeMode: RangeMode;
  customStartDate: string;
  customEndDate: string;
}): string {
  const params = new URLSearchParams();
  const dateFrom = rangeMode === 'custom' ? customStartDate : getDateFrom(dateRange);
  const dateTo = rangeMode === 'custom' ? customEndDate : getToday();
  if (dateFrom) params.set('dateFrom', dateFrom);
  if (dateTo) params.set('dateTo', dateTo);
  params.set('limit', '10');
  return `?${params.toString()}`;
}

function normalizeRankedMetricList(items: any[], labelKey: string, valueKey: string, secondary?: (item: any) => string | undefined): RankedMetric[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    label: String(item?.[labelKey] ?? 'Unknown'),
    value: toNumber(item?.[valueKey]),
    secondary: secondary ? secondary(item) : undefined,
  }));
}

function normalizeBreakdownList(items: any[], config: {
  labelKey: string;
  secondary?: (item: any) => string | undefined;
  tertiary?: (item: any) => string | undefined;
}): BreakdownItem[] {
  return (Array.isArray(items) ? items : []).map((item) => ({
    id: item?.id ? String(item.id) : undefined,
    label: String(item?.[config.labelKey] ?? 'Unknown'),
    secondary: config.secondary ? config.secondary(item) : undefined,
    tertiary: config.tertiary ? config.tertiary(item) : undefined,
    impressions: toNumber(item?.impressions),
    clicks: toNumber(item?.clicks),
    ctr: toNumber(item?.ctr),
    uniqueIdentities: toNumber(item?.uniqueIdentities ?? item?.unique_identities),
    avgFrequency: toNumber(item?.avgFrequency ?? item?.avg_frequency),
    viewableImpressions: toNumber(item?.viewableImps ?? item?.viewable_imps),
    measuredImpressions: toNumber(item?.measuredImps ?? item?.measured_imps),
    undeterminedImpressions: toNumber(item?.undeterminedImps ?? item?.undetermined_imps),
    viewabilityRate: toNumber(item?.viewabilityRate ?? item?.viewability_rate),
  }));
}

function normalizeWorkspaceAnalytics(
  workspacePayload: any,
  campaignPayload: any,
  tagPayload: any,
  sitePayload: any,
  countryPayload: any,
  regionPayload: any,
  cityPayload: any,
  engagementPayload: any,
  identityPayload: any,
  identityFrequencyPayload: any,
  identitySegmentsPayload: any,
  identityKeyPayload: any,
  creativePayload: any,
  variantPayload: any,
): WorkspaceAnalytics {
  const source = workspacePayload?.stats ?? workspacePayload ?? {};

  return {
    totalImpressions: toNumber(source?.totalImpressions ?? source?.total_impressions),
    totalClicks: toNumber(source?.totalClicks ?? source?.total_clicks),
    totalSpend: toNumber(source?.totalSpend ?? source?.total_spend),
    totalViewableImpressions: toNumber(source?.totalViewableImpressions ?? source?.total_viewable_impressions),
    totalMeasuredImpressions: toNumber(source?.totalMeasuredImpressions ?? source?.total_measured_impressions),
    totalUndeterminedImpressions: toNumber(source?.totalUndeterminedImpressions ?? source?.total_undetermined_impressions),
    measurableRate: toNumber(source?.measurableRate ?? source?.measurable_rate),
    viewabilityRate: toNumber(source?.viewabilityRate ?? source?.viewability_rate),
    avgCtr: toNumber(source?.avgCtr ?? source?.avg_ctr),
    totalEngagements: toNumber(source?.totalEngagements ?? source?.total_engagements),
    totalHoverDurationMs: toNumber(source?.totalHoverDurationMs ?? source?.total_hover_duration_ms),
    totalIdentities: toNumber(source?.totalIdentities ?? source?.total_identities),
    avgIdentityFrequency: toNumber(source?.avgIdentityFrequency ?? source?.avg_identity_frequency),
    avgIdentityClicks: toNumber(source?.avgIdentityClicks ?? source?.avg_identity_clicks),
    activeCampaigns: toNumber(source?.activeCampaigns ?? source?.active_campaigns),
    activeTags: toNumber(source?.activeTags ?? source?.active_tags),
    totalCreatives: toNumber(source?.totalCreatives ?? source?.total_creatives),
    campaigns: normalizeBreakdownList(campaignPayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.status ?? 'unknown')} · ${fmtCtr(toNumber(item?.viewabilityRate ?? item?.viewability_rate))} viewability`,
      tertiary: (item) => `${fmtNum(toNumber(item?.viewableImps ?? item?.viewable_imps))} viewable of ${fmtNum(toNumber(item?.measuredImps ?? item?.measured_imps))} measured · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    tags: normalizeBreakdownList(tagPayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.format ?? 'unknown')} · ${fmtCtr(toNumber(item?.viewabilityRate ?? item?.viewability_rate))} viewability`,
      tertiary: (item) => `${String(item?.status ?? 'unknown')} · ${fmtNum(toNumber(item?.viewableImps ?? item?.viewable_imps))} of ${fmtNum(toNumber(item?.measuredImps ?? item?.measured_imps))} measured · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    creatives: normalizeBreakdownList(creativePayload?.breakdown ?? [], {
      labelKey: 'name',
      secondary: (item) => `${String(item?.source_kind ?? 'unknown')} · v${String(item?.version_number ?? '—')}`,
      tertiary: (item) => `${String(item?.serving_format ?? 'unknown')} · ${fmtNum(toNumber(item?.uniqueIdentities ?? item?.unique_identities))} unique identities · ${toNumber(item?.avgFrequency ?? item?.avg_frequency).toFixed(2)} avg frequency`,
    }),
    variants: (Array.isArray(variantPayload?.breakdown) ? variantPayload.breakdown : []).map((item: any) => ({
      id: String(item?.id ?? ''),
      creativeName: String(item?.creative_name ?? 'Untitled creative'),
      label: String(item?.label ?? 'Variant'),
      size: `${toNumber(item?.width)}x${toNumber(item?.height)}`,
      status: String(item?.status ?? 'unknown'),
      impressions: toNumber(item?.impressions),
      clicks: toNumber(item?.clicks),
      ctr: toNumber(item?.ctr),
      uniqueIdentities: toNumber(item?.uniqueIdentities ?? item?.unique_identities),
      avgFrequency: toNumber(item?.avgFrequency ?? item?.avg_frequency),
    })),
    topSites: normalizeRankedMetricList(sitePayload?.breakdown ?? [], 'site_domain', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured`),
    topCountries: normalizeRankedMetricList(countryPayload?.breakdown ?? [], 'country', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured`),
    topRegions: normalizeRankedMetricList(regionPayload?.breakdown ?? [], 'region', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured`),
    topCities: normalizeRankedMetricList(cityPayload?.breakdown ?? [], 'city', 'impressions', (item) => `${fmtCtr(toNumber(item?.ctr))} CTR · ${fmtCtr(toNumber(item?.viewability_rate))} viewability · ${fmtNum(toNumber(item?.viewable_imps))}/${fmtNum(toNumber(item?.measured_imps))} measured`),
    topIdentities: normalizeRankedMetricList(identityPayload?.breakdown ?? [], 'canonical_value', 'impressions', (item) => {
      const location = [item?.last_city, item?.last_region, item?.last_country].filter(Boolean).join(', ');
      return `${String(item?.canonical_type ?? 'identity')} · ${fmtCtr(toNumber(item?.ctr))} CTR${location ? ` · ${location}` : ''}`;
    }),
    identityFrequency: normalizeRankedMetricList(identityFrequencyPayload?.breakdown ?? [], 'bucket_label', 'identity_count', (item) => {
      return `${fmtNum(toNumber(item?.impressions))} imps · ${fmtNum(toNumber(item?.clicks))} clicks · ${fmtCtr(toNumber(item?.ctr))} CTR`;
    }),
    identitySegments: normalizeRankedMetricList(identitySegmentsPayload?.breakdown ?? [], 'label', 'identity_count', (item) => {
      return `${fmtNum(toNumber(item?.impressions))} imps · ${fmtNum(toNumber(item?.clicks))} clicks · ${fmtNum(toNumber(item?.engagements))} engagements`;
    }),
    identityKeyBreakdown: normalizeRankedMetricList(identityKeyPayload?.breakdown ?? [], 'key_type', 'key_observations', (item) => {
      return `${String(item?.event_type ?? 'unknown')} · ${fmtNum(toNumber(item?.unique_values))} unique values · ${fmtNum(toNumber(item?.identity_count))} identities`;
    }),
    engagements: normalizeRankedMetricList(engagementPayload?.breakdown ?? [], 'event_type', 'event_count', (item) => {
      const duration = toNumber(item?.total_duration_ms);
      return duration > 0 ? `${fmtNum(duration)} ms total` : undefined;
    }),
  };
}

function KpiCard({ label, value, icon, color, sub }: { label: string; value: string; icon: string; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-slate-500 font-medium">{label}</p>
        <span className="text-2xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-1">{sub}</p> : null}
    </div>
  );
}

function RankedList({ title, emptyLabel, items }: { title: string; emptyLabel: string; items: RankedMetric[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {!items.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">{emptyLabel}</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={`${title}-${item.label}`} className="flex items-center justify-between gap-4 px-5 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                {item.secondary ? <p className="mt-0.5 text-xs text-slate-500">{item.secondary}</p> : null}
              </div>
              <p className="text-sm font-semibold text-slate-700">{fmtNum(item.value)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BreakdownTable({
  title,
  emptyLabel,
  rows,
  secondaryLabel,
}: {
  title: string;
  emptyLabel: string;
  rows: BreakdownItem[];
  secondaryLabel: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">{title}</h2>
      </div>
      {!rows.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">{emptyLabel}</div>
      ) : (
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {['Name', secondaryLabel, 'Impressions', 'Clicks', 'CTR'].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id ?? `${row.label}-${index}`} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[220px] truncate">{row.label}</td>
                <td className="px-4 py-3 text-sm text-slate-600">
                  {row.secondary ?? '—'}
                  {row.tertiary ? <span className="block text-xs text-slate-400 mt-0.5">{row.tertiary}</span> : null}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.clicks)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(row.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function VariantTable({ rows }: { rows: VariantItem[] }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-base font-semibold text-slate-800">Top Variants</h2>
      </div>
      {!rows.length ? (
        <div className="px-5 py-10 text-center text-sm text-slate-400">No variant data available</div>
      ) : (
        <table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50">
            <tr>
              {['Creative', 'Variant', 'Size', 'Status', 'Impressions', 'CTR'].map((heading) => (
                <th key={heading} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-slate-800 max-w-[200px] truncate">{row.creativeName}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {row.label}
                  <span className="block text-xs text-slate-400 mt-0.5">
                    {fmtNum(row.uniqueIdentities ?? 0)} unique identities · {(row.avgFrequency ?? 0).toFixed(2)} avg frequency
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.size}</td>
                <td className="px-4 py-3 text-sm text-slate-600 capitalize">{row.status}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtNum(row.impressions)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{fmtCtr(row.ctr)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [data, setData] = useState<WorkspaceAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dateRange, setDateRange] = useState<DateRange>(30);
  const [rangeMode, setRangeMode] = useState<RangeMode>('preset');
  const [customStartDate, setCustomStartDate] = useState(() => getDateFrom(30));
  const [customEndDate, setCustomEndDate] = useState(() => getToday());
  const [identityTypeFilter, setIdentityTypeFilter] = useState<IdentityTypeFilter>('');
  const [identityCountryFilter, setIdentityCountryFilter] = useState('');
  const [identityMinImpressions, setIdentityMinImpressions] = useState('1');
  const [identityMinClicks, setIdentityMinClicks] = useState('0');
  const [identitySegmentPreset, setIdentitySegmentPreset] = useState<IdentitySegmentPreset>('');

  const query = useMemo(() => makeQuery({
    dateRange,
    rangeMode,
    customStartDate,
    customEndDate,
  }), [dateRange, rangeMode, customStartDate, customEndDate]);
  const identityQuery = useMemo(() => {
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
    if (identityTypeFilter) params.set('canonicalType', identityTypeFilter);
    return `?${params.toString()}`;
  }, [query, identityTypeFilter]);
  const identityAudienceQuery = useMemo(() => {
    const params = new URLSearchParams(identityQuery.startsWith('?') ? identityQuery.slice(1) : identityQuery);
    if (identityCountryFilter.trim()) params.set('country', identityCountryFilter.trim().toUpperCase());
    if (identitySegmentPreset) params.set('segmentPreset', identitySegmentPreset);
    if (identityMinImpressions.trim()) params.set('minImpressions', identityMinImpressions.trim());
    if (identityMinClicks.trim()) params.set('minClicks', identityMinClicks.trim());
    return `?${params.toString()}`;
  }, [identityQuery, identityCountryFilter, identitySegmentPreset, identityMinImpressions, identityMinClicks]);
  const customDatesValid = Boolean(customStartDate && customEndDate && customStartDate <= customEndDate);

  const load = () => {
    setLoading(true);
    setError('');

    Promise.all([
      fetch(`/v1/reporting/workspace${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load analytics');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/campaign-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load campaign breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/tag-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load tag breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/site-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load site breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/country-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load country breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/region-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load region breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/city-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load city breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/engagement-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load engagement breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-breakdown${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-frequency-buckets${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity frequency');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-segment-presets${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity segments');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/identity-key-breakdown${identityQuery}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load identity key breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/creative-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load creative breakdown');
        return r.json();
      }),
      fetch(`/v1/reporting/workspace/variant-breakdown${query}`, { credentials: 'include' }).then((r) => {
        if (!r.ok) throw new Error('Failed to load variant breakdown');
        return r.json();
      }),
    ])
      .then(([workspace, campaigns, tags, sites, countries, regions, cities, engagements, identities, identityFrequency, identitySegments, identityKeys, creatives, variants]) => {
        setData(normalizeWorkspaceAnalytics(workspace, campaigns, tags, sites, countries, regions, cities, engagements, identities, identityFrequency, identitySegments, identityKeys, creatives, variants));
      })
      .catch((loadError: any) => setError(loadError.message ?? 'Failed to load analytics'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (rangeMode === 'custom' && !customDatesValid) return;
    load();
  }, [query, identityQuery]);

  const handleExportIdentityCsv = async () => {
    try {
      const response = await fetch(`/v1/reporting/workspace/identity-export${identityQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export identity report');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `identity-report${identityTypeFilter ? `-${identityTypeFilter}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Failed to export identity CSV.');
    }
  };

  const handleExportIdentityAudienceCsv = async () => {
    try {
      const response = await fetch(`/v1/reporting/workspace/identity-audience-export${identityAudienceQuery}`, {
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to export identity audience');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `identity-audience${identityTypeFilter ? `-${identityTypeFilter}` : ''}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Failed to export audience CSV.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p className="font-medium">Error loading analytics</p>
        <p className="text-sm mt-1">{error}</p>
        <button onClick={load} className="mt-3 text-sm text-red-600 underline">Retry</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reporting</h1>
          <p className="text-sm text-slate-500 mt-1">
            Workspace-level performance with site, country, tag, creative, variant, and rich media signals.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <div className="flex rounded-lg border border-slate-200 bg-white p-1">
            {DATE_RANGES.map((range) => (
              <button
                key={range}
                onClick={() => {
                  setRangeMode('preset');
                  setDateRange(range);
                }}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  rangeMode === 'preset' && dateRange === range
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {formatRange(range)}
              </button>
            ))}
          </div>
          <div className={`flex items-center gap-2 rounded-lg border p-2 ${rangeMode === 'custom' ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
            <button
              onClick={() => setRangeMode('custom')}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                rangeMode === 'custom' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              Custom
            </button>
            <input
              type="date"
              value={customStartDate}
              onChange={(event) => {
                setRangeMode('custom');
                setCustomStartDate(event.target.value);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={customEndDate}
              onChange={(event) => {
                setRangeMode('custom');
                setCustomEndDate(event.target.value);
              }}
              className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-700"
            />
          </div>
          <button
            onClick={load}
            disabled={rangeMode === 'custom' && !customDatesValid}
            className="px-4 py-2 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {rangeMode === 'custom' && !customDatesValid ? (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          Choose a valid custom range. The start date needs to be before or equal to the end date.
        </div>
      ) : null}

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <KpiCard label="Impressions" value={fmtNum(data?.totalImpressions ?? 0)} icon="👁️" color="text-slate-800" />
        <KpiCard label="Clicks" value={fmtNum(data?.totalClicks ?? 0)} icon="🖱️" color="text-blue-700" />
        <KpiCard label="Spend" value={fmtCurrency(data?.totalSpend ?? 0)} icon="💸" color="text-emerald-700" />
        <KpiCard label="CTR" value={fmtCtr(data?.avgCtr ?? 0)} icon="📈" color="text-indigo-700" />
        <KpiCard
          label="Viewability"
          value={fmtCtr(data?.viewabilityRate ?? 0)}
          icon="🎯"
          color="text-fuchsia-700"
          sub={`${fmtNum(data?.totalViewableImpressions ?? 0)} viewable of ${fmtNum(data?.totalMeasuredImpressions ?? 0)} measured · ${fmtCtr(data?.measurableRate ?? 0)} measurable`}
        />
        <KpiCard label="Engagements" value={fmtNum(data?.totalEngagements ?? 0)} icon="✨" color="text-amber-700" sub={`${fmtNum(data?.totalHoverDurationMs ?? 0)} ms hover time`} />
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        <KpiCard label="Active Campaigns" value={String(data?.activeCampaigns ?? 0)} icon="📋" color="text-slate-800" />
        <KpiCard label="Active Tags" value={String(data?.activeTags ?? 0)} icon="🏷️" color="text-slate-800" />
        <KpiCard label="Creatives" value={String(data?.totalCreatives ?? 0)} icon="🧩" color="text-slate-800" />
        <KpiCard
          label="Measurable Rate"
          value={fmtCtr(data?.measurableRate ?? 0)}
          icon="🧪"
          color="text-slate-800"
          sub={`${fmtNum(data?.totalUndeterminedImpressions ?? 0)} undetermined impressions`}
        />
        <KpiCard
          label="Identities"
          value={fmtNum(data?.totalIdentities ?? 0)}
          icon="🪪"
          color="text-slate-800"
          sub={`${(data?.avgIdentityFrequency ?? 0).toFixed(2)} avg impressions · ${(data?.avgIdentityClicks ?? 0).toFixed(2)} avg clicks`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mb-6">
        <RankedList title="Top Sites" emptyLabel="No site data available" items={data?.topSites ?? []} />
        <RankedList title="Top Countries" emptyLabel="No country data available" items={data?.topCountries ?? []} />
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-800">Top Identities</h2>
              <p className="text-xs text-slate-500 mt-1">Filter by canonical identity type and export the current reach/frequency cut.</p>
            </div>
            <div className="flex items-center gap-2">
              <select
                value={identityTypeFilter}
                onChange={(event) => setIdentityTypeFilter(event.target.value as IdentityTypeFilter)}
                className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
              >
                {IDENTITY_FILTERS.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                onClick={() => void handleExportIdentityCsv()}
                className="px-3 py-2 text-xs border border-slate-300 text-slate-700 rounded-md hover:bg-slate-50 transition-colors"
              >
                Export CSV
              </button>
            </div>
          </div>
          <div className="px-5 py-3 border-b border-slate-100 flex flex-wrap items-center gap-2 bg-slate-50/60">
            <input
              value={identityCountryFilter}
              onChange={(event) => setIdentityCountryFilter(event.target.value)}
              placeholder="Country (e.g. SV)"
              className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
            />
            <select
              value={identitySegmentPreset}
              onChange={(event) => setIdentitySegmentPreset(event.target.value as IdentitySegmentPreset)}
              className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
            >
              {IDENTITY_SEGMENT_PRESETS.map((option) => (
                <option key={option.value || 'custom'} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input
              value={identityMinImpressions}
              onChange={(event) => setIdentityMinImpressions(event.target.value)}
              placeholder="Min impressions"
              inputMode="numeric"
              className="w-28 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
            />
            <input
              value={identityMinClicks}
              onChange={(event) => setIdentityMinClicks(event.target.value)}
              placeholder="Min clicks"
              inputMode="numeric"
              className="w-24 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700"
            />
            <button
              onClick={() => void handleExportIdentityAudienceCsv()}
              className="px-3 py-2 text-xs border border-indigo-300 text-indigo-700 rounded-md hover:bg-indigo-50 transition-colors"
            >
              Export Audience
            </button>
          </div>
          <div className="divide-y divide-slate-100">
            {(data?.topIdentities ?? []).length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-400">No identity data available</div>
            ) : (
              (data?.topIdentities ?? []).map((item) => (
                <div key={`identity-${item.label}`} className="flex items-center justify-between gap-4 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">{item.label}</p>
                    {item.secondary ? <p className="mt-0.5 text-xs text-slate-500">{item.secondary}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">{fmtNum(item.value)}</p>
                    <p className="text-xs text-slate-400">impressions</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <RankedList title="Engagement Mix" emptyLabel="No engagement data available" items={data?.engagements ?? []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <RankedList title="Top Regions" emptyLabel="No region data available" items={data?.topRegions ?? []} />
        <RankedList title="Top Cities" emptyLabel="No city data available" items={data?.topCities ?? []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <RankedList title="Identity Frequency Buckets" emptyLabel="No identity frequency data available" items={data?.identityFrequency ?? []} />
        <RankedList title="Identity Segment Presets" emptyLabel="No identity segment data available" items={data?.identitySegments ?? []} />
      </div>

      <div className="grid grid-cols-1 gap-6 mb-6">
        <RankedList title="Identity Keys by Event" emptyLabel="No identity key data available" items={data?.identityKeyBreakdown ?? []} />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6">
        <BreakdownTable
          title="Campaign Performance"
          emptyLabel="No campaign data available"
          rows={data?.campaigns ?? []}
          secondaryLabel="Status"
        />
        <BreakdownTable
          title="Tag Performance"
          emptyLabel="No tag data available"
          rows={data?.tags ?? []}
          secondaryLabel="Format"
        />
      </div>

      <div className="grid grid-cols-1 gap-6">
        <BreakdownTable
          title="Creative Performance"
          emptyLabel="No creative data available"
          rows={data?.creatives ?? []}
          secondaryLabel="Version"
        />
        <VariantTable rows={data?.variants ?? []} />
      </div>
    </div>
  );
}
