import React, { useEffect, useMemo, useState } from 'react';
import { Link, useOutletContext } from 'react-router-dom';
import { loadCreatives, type Creative } from '../creatives/catalog';
import { loadAuthMe, loadWorkspaces, switchWorkspace, type WorkspaceOption } from '../shared/workspaces';
import { type ThemeMode } from '../shared/theme';
import { Button, CenteredSpinner, Input, Kicker, MetricCard, Panel } from '../system';
import {
  AttentionCard,
  CampaignTable,
  ChevronDownIcon,
  EyeIcon,
  MetricIcon,
  NotificationButton,
  SearchIcon,
  AudienceInsights,
  QuickNavigation,
  SystemHealth,
  WorkQueueTable,
} from './overview.components';
import {
  type AttentionItem,
  type AudienceRow,
  type AuthPayload,
  type BreakdownItem,
  type Campaign,
  type DateRange,
  type MetricCardData,
  type QuickNavRow,
  type SegmentBreakdownItem,
  type SystemHealthRow,
  type Tag,
  type TimelinePoint,
  type TopCampaignRow,
  type TrendDirection,
  type WorkQueueRow,
  type WorkspaceStats,
} from './overview.types';
import {
  DEFAULT_DATE_RANGE,
  buildQuery,
  computeDelta,
  fetchJson,
  fmtCurrency,
  fmtNum,
  fmtPct,
  fmtPctCompact,
  getDateFrom,
  getPreviousRange,
  toNumber,
} from './overview.utils';

export default function AdOpsOverview() {
  const { theme, toggleTheme } = useOutletContext<{ theme: ThemeMode; toggleTheme: () => void }>();
  const [dateRange, setDateRange] = useState<DateRange>(DEFAULT_DATE_RANGE);
  const [campaignId, setCampaignId] = useState('');
  const [overviewSearch, setOverviewSearch] = useState('');
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [creatives, setCreatives] = useState<Creative[]>([]);
  const [workspaces, setWorkspaces] = useState<WorkspaceOption[]>([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentStats, setCurrentStats] = useState<WorkspaceStats>({});
  const [previousStats, setPreviousStats] = useState<WorkspaceStats>({});
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [campaignBreakdown, setCampaignBreakdown] = useState<BreakdownItem[]>([]);
  const [tagBreakdown, setTagBreakdown] = useState<BreakdownItem[]>([]);
  const [creativeBreakdown, setCreativeBreakdown] = useState<BreakdownItem[]>([]);
  const [identitySegments, setIdentitySegments] = useState<SegmentBreakdownItem[]>([]);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadAuthMe() as Promise<AuthPayload>,
      loadWorkspaces('ad_server').catch(() => [] as WorkspaceOption[]),
      fetchJson<{ campaigns?: Campaign[] }>('/v1/campaigns?scope=all').catch(() => ({ campaigns: [] })),
      fetchJson<{ tags?: Tag[] }>('/v1/tags?scope=all').catch(() => ({ tags: [] })),
      loadCreatives({ scope: 'all' }).catch(() => [] as Creative[]),
    ])
      .then(([authMe, workspaceList, campaignPayload, tagPayload, creativeList]) => {
        if (!active) return;
        setActiveWorkspaceId(authMe?.workspace?.id ?? '');
        setWorkspaces(workspaceList);
        setCampaigns(campaignPayload.campaigns ?? []);
        setTags(tagPayload.tags ?? []);
        setCreatives(creativeList);
      })
      .catch((loadError: any) => {
        if (!active) return;
        setError(loadError.message ?? 'Failed to load overview.');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const dateFrom = getDateFrom(dateRange);
    const dateTo = new Date().toISOString().slice(0, 10);
    const previousRange = getPreviousRange(dateRange);
    const currentQuery = buildQuery({ dateFrom, dateTo, campaignId });
    const previousQuery = buildQuery({ dateFrom: previousRange.dateFrom, dateTo: previousRange.dateTo, campaignId });
    setLoading(true);
    setError('');
    Promise.all([
      fetchJson<{ stats?: WorkspaceStats; timeline?: TimelinePoint[] }>(`/v1/reporting/workspace${currentQuery}`),
      fetchJson<{ stats?: WorkspaceStats }>(`/v1/reporting/workspace${previousQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/campaign-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/tag-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: BreakdownItem[] }>(`/v1/reporting/workspace/creative-breakdown${currentQuery}`),
      fetchJson<{ breakdown?: SegmentBreakdownItem[] }>(`/v1/reporting/workspace/identity-segment-presets${currentQuery}`).catch(() => ({ breakdown: [] })),
    ])
      .then(([currentPayload, previousPayload, campaignPayload, tagPayload, creativePayload, segmentPayload]) => {
        setCurrentStats(currentPayload.stats ?? {});
        setPreviousStats(previousPayload.stats ?? {});
        setTimeline(Array.isArray(currentPayload.timeline) ? currentPayload.timeline : []);
        setCampaignBreakdown(campaignPayload.breakdown ?? []);
        setTagBreakdown(tagPayload.breakdown ?? []);
        setCreativeBreakdown(creativePayload.breakdown ?? []);
        setIdentitySegments(segmentPayload.breakdown ?? []);
      })
      .catch((loadError: any) => {
        setError(loadError.message ?? 'Failed to load overview metrics.');
      })
      .finally(() => setLoading(false));
  }, [dateRange, campaignId, activeWorkspaceId]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const items: AttentionItem[] = [];
    const lowCtrCampaign = [...campaignBreakdown]
      .filter((item) => toNumber(item.impressions) > 0)
      .sort((left, right) => toNumber(left.ctr) - toNumber(right.ctr))[0];
    if (lowCtrCampaign) {
      const delta = computeDelta(toNumber(lowCtrCampaign.ctr), toNumber(previousStats.avg_ctr)).label;
      items.push({
        id: 'campaign-low-ctr',
        title: `Campaign “${lowCtrCampaign.name ?? lowCtrCampaign.label ?? 'Untitled'}”`,
        detail: `CTR ${fmtPctCompact(toNumber(lowCtrCampaign.ctr))} (${delta})`,
        actionLabel: 'Fix now',
        actionHref: '/campaigns',
        severity: toNumber(lowCtrCampaign.ctr) < 0.5 ? 'critical' : 'warning',
      });
    }

    const creativeDeliveryMap = new Map<string, number>();
    creativeBreakdown.forEach((item) => {
      creativeDeliveryMap.set(String(item.name ?? item.label ?? ''), toNumber(item.impressions));
    });
    const missingCreatives = creatives.filter((creative) => {
      const latestStatus = creative.latestVersion?.status;
      const ready = latestStatus === 'approved' || latestStatus === 'pending_review';
      return ready && toNumber(creativeDeliveryMap.get(creative.name) ?? 0) === 0;
    });
    items.push({
      id: 'creatives-without-delivery',
      title: missingCreatives.length ? `${missingCreatives.length} creatives without impressions` : 'Creatives delivery looks healthy',
      detail: missingCreatives.length ? 'Review performance and assignments' : 'All ready creatives have delivery in the selected range.',
      actionLabel: missingCreatives.length ? 'Review' : 'Open creatives',
      actionHref: '/creatives',
      severity: missingCreatives.length ? (missingCreatives.length > 2 ? 'warning' : 'notice') : 'healthy',
    });

    const inactiveTag = tags.find((tag) => tag.status !== 'active');
    const staleTag = !inactiveTag
      ? [...tagBreakdown].sort((left, right) => toNumber(left.impressions) - toNumber(right.impressions))[0]
      : null;
    if (inactiveTag || staleTag) {
      const name = inactiveTag?.name ?? staleTag?.name ?? staleTag?.label ?? 'Tag';
      const detail = inactiveTag
        ? `Status: ${inactiveTag.status}`
        : `Impressions ${fmtNum(toNumber(staleTag?.impressions))} in selected range`;
      items.push({
        id: 'tag-inactive',
        title: `Tag “${name}” needs review`,
        detail,
        actionLabel: 'Fix now',
        actionHref: '/tags',
        severity: inactiveTag ? 'notice' : 'warning',
      });
    }

    while (items.length < 3) {
      items.push({
        id: `healthy-${items.length}`,
        title: 'No additional blockers detected',
        detail: 'Delivery, tags, and creatives look stable for the current filters.',
        actionLabel: 'View reporting',
        actionHref: '/reporting',
        severity: 'healthy',
      });
    }

    return items.slice(0, 3);
  }, [campaignBreakdown, creatives, creativeBreakdown, previousStats.avg_ctr, tagBreakdown, tags]);

  const metricCards = useMemo<MetricCardData[]>(() => {
    const spendDelta = computeDelta(toNumber(currentStats.total_spend), toNumber(previousStats.total_spend));
    const impressionsDelta = computeDelta(toNumber(currentStats.total_impressions), toNumber(previousStats.total_impressions));
    const healthyCampaigns = campaignBreakdown.filter((item) => toNumber(item.impressions) > 0 && toNumber(item.ctr) >= 0.5).length;
    const totalCampaigns = Math.max(campaignBreakdown.length || campaigns.length, 1);
    const deliveryHealth = Math.round((healthyCampaigns / totalCampaigns) * 100);
    const deliveryHealthDelta = computeDelta(deliveryHealth, Math.max(deliveryHealth - 8, 0));
    const discrepancyRisk = attentionItems.filter((item) => item.severity === 'critical' || item.severity === 'warning').length;
    const discrepancyDelta = computeDelta(discrepancyRisk, Math.max(discrepancyRisk - 1, 0));
    const safeTimeline = timeline.length ? [...timeline].reverse() : [];
    return [
      {
        id: 'spend',
        label: 'Delivery health',
        value: `${deliveryHealth}%`,
        delta: deliveryHealthDelta.label,
        direction: deliveryHealthDelta.direction,
        icon: 'viewability',
        tone: 'from-emerald-400/20 via-emerald-500/12 to-transparent text-emerald-400 dark:text-emerald-300',
        series: safeTimeline.map((point) => toNumber(point.viewability_rate)),
        context: `${healthyCampaigns} campaigns currently healthy`,
      },
      {
        id: 'impressions',
        label: 'On-pace budget',
        value: fmtCurrency(toNumber(currentStats.total_spend)),
        delta: spendDelta.label,
        direction: spendDelta.direction,
        icon: 'spend',
        tone: 'from-sky-400/20 via-sky-500/12 to-transparent text-sky-400 dark:text-sky-300',
        series: safeTimeline.map((point) => toNumber(point.spend)),
        context: 'Tracked across live campaign budgets',
      },
      {
        id: 'ctr',
        label: 'Tag events',
        value: fmtNum(toNumber(currentStats.total_impressions)),
        delta: impressionsDelta.label,
        direction: impressionsDelta.direction,
        icon: 'impressions',
        tone: 'from-fuchsia-400/20 via-fuchsia-500/12 to-transparent text-fuchsia-400 dark:text-fuchsia-300',
        series: safeTimeline.map((point) => toNumber(point.impressions)),
        context: 'Signals captured in the selected range',
      },
      {
        id: 'engagements',
        label: 'Discrepancy risk',
        value: `${discrepancyRisk}`,
        delta: discrepancyDelta.label,
        direction: discrepancyDelta.direction,
        icon: 'engagements',
        tone: 'from-violet-400/20 via-violet-500/12 to-transparent text-violet-400 dark:text-violet-300',
        series: safeTimeline.map((point) => toNumber(point.clicks)),
        context: `${discrepancyRisk} items require review`,
      },
    ];
  }, [attentionItems, campaignBreakdown, campaigns.length, currentStats, previousStats, timeline]);

  const topCampaignRows = useMemo<TopCampaignRow[]>(() => {
    return [...campaignBreakdown]
      .sort((left, right) => toNumber(right.spend) - toNumber(left.spend))
      .slice(0, 4)
      .map((item) => {
        const ctr = toNumber(item.ctr);
        return {
          id: String(item.id ?? item.name ?? item.label ?? Math.random()),
          name: String(item.name ?? item.label ?? 'Untitled campaign'),
          spend: fmtCurrency(toNumber(item.spend)),
          ctr: fmtPctCompact(ctr),
          status: ctr >= 1 ? 'Healthy' : ctr >= 0.5 ? 'Needs optimization' : 'Critical',
        };
      });
  }, [campaignBreakdown]);

  const quickNavRows = useMemo<QuickNavRow[]>(() => {
    const activeCampaignCount = campaigns.filter((item) => item.status === 'active').length;
    const activeTagCount = tags.filter((item) => item.status === 'active').length;
    const inactiveTagCount = tags.filter((item) => item.status !== 'active').length;
    const lowCtrCampaignCount = campaignBreakdown.filter((item) => toNumber(item.ctr) > 0 && toNumber(item.ctr) < 0.5).length;
    const lowCtrCreatives = creativeBreakdown.filter((item) => toNumber(item.ctr) > 0 && toNumber(item.ctr) < 0.5).length;
    const activeCreatives = creatives.filter((item) => item.latestVersion?.status === 'approved' || item.latestVersion?.status === 'pending_review').length;
    return [
      { id: 'campaigns', label: 'Campaigns', detail: `${activeCampaignCount} active / ${lowCtrCampaignCount} issues`, to: '/campaigns', icon: 'campaigns', tone: 'from-violet-500/30 to-fuchsia-500/10 text-violet-300' },
      { id: 'creatives', label: 'Creatives', detail: `${activeCreatives} ready / ${lowCtrCreatives} low CTR`, to: '/creatives', icon: 'creatives', tone: 'from-fuchsia-500/30 to-rose-500/10 text-fuchsia-300' },
      { id: 'tags', label: 'Tags', detail: `${activeTagCount} live / ${inactiveTagCount} inactive`, to: '/tags', icon: 'tags', tone: 'from-amber-500/30 to-orange-500/10 text-amber-300' },
      { id: 'analytics', label: 'Analytics', detail: 'Full reporting & insights', to: '/reporting', icon: 'analytics', tone: 'from-sky-500/30 to-cyan-500/10 text-sky-300' },
    ];
  }, [campaignBreakdown, campaigns, creativeBreakdown, creatives, tags]);

  const systemHealthRows = useMemo<SystemHealthRow[]>(() => {
    const liveTags = tags.filter((item) => item.status === 'active').length;
    const liveCreatives = creatives.filter((item) => item.latestVersion?.status === 'approved').length;
    const missingCreatives = creatives.filter((creative) => {
      const latestStatus = creative.latestVersion?.status;
      const ready = latestStatus === 'approved' || latestStatus === 'pending_review';
      if (!ready) return false;
      const breakdown = creativeBreakdown.find((item) => String(item.name ?? item.label ?? '') === creative.name);
      return toNumber(breakdown?.impressions) === 0;
    }).length;
    return [
      { id: 'tags-live', label: 'Tags live', value: `${liveTags}/${Math.max(tags.length, 1)}`, note: `${Math.max(tags.length - liveTags, 0)} inactive`, severity: liveTags === tags.length ? 'positive' : 'notice' },
      { id: 'creatives-live', label: 'Creatives live', value: `${liveCreatives}`, note: `${missingCreatives} without delivery`, severity: missingCreatives === 0 ? 'positive' : 'warning' },
      { id: 'fill-rate', label: 'Fill rate', value: fmtPctCompact(toNumber(currentStats.measurable_rate)), note: toNumber(currentStats.measurable_rate) < 80 ? 'Below expected' : 'Healthy', severity: toNumber(currentStats.measurable_rate) < 65 ? 'critical' : toNumber(currentStats.measurable_rate) < 80 ? 'warning' : 'positive' },
      { id: 'ad-requests', label: 'Ad requests', value: fmtNum(toNumber(currentStats.total_impressions)), note: computeDelta(toNumber(currentStats.total_impressions), toNumber(previousStats.total_impressions)).label, severity: 'positive' },
      { id: 'errors', label: 'Errors', value: fmtPct(0), note: 'Low', severity: 'positive' },
    ];
  }, [creativeBreakdown, creatives, currentStats, previousStats.total_impressions, tags]);

  const audience = useMemo(() => {
    const normalized = identitySegments
      .map((item, index) => {
        const delta = computeDelta(toNumber(item.clicks), Math.max(toNumber(item.impressions) - toNumber(item.clicks), 0));
        return {
          id: `${item.label ?? item.name ?? index}`,
          name: String(item.label ?? item.name ?? 'Unknown segment'),
          ctr: fmtPctCompact(toNumber(item.ctr)),
          delta: delta.label,
          direction: delta.direction,
          score: Math.max(8, Math.min(toNumber(item.ctr) * 40, 100)),
        };
      })
      .sort((left, right) => parseFloat(right.ctr) - parseFloat(left.ctr));

    const topSegments = normalized.slice(0, 3);
    const underperformingSegments = [...normalized].reverse().slice(0, 3);

    if (!topSegments.length) {
      return {
        topSegments: [{ id: 'top-empty', name: 'No segment data yet', ctr: '0.0%', delta: '0%', direction: 'flat' as TrendDirection, score: 8 }],
        underperformingSegments: [{ id: 'under-empty', name: 'No segment data yet', ctr: '0.0%', delta: '0%', direction: 'flat' as TrendDirection, score: 8 }],
      };
    }

    return { topSegments, underperformingSegments };
  }, [identitySegments]);

  const selectedWorkspaceName = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.name ?? 'Workspace';

  const workQueueRows = useMemo<WorkQueueRow[]>(() => {
    const baseRows = attentionItems.map((item) => ({
      id: item.id,
      stage:
        item.id.includes('campaign') ? 'Campaign' :
        item.id.includes('creative') ? 'Creative' :
        item.id.includes('tag') ? 'Tag' : 'Ops',
      issue: item.title,
      advertiser: selectedWorkspaceName,
      owner: 'Ad Ops',
      due: item.severity === 'critical' ? 'Today' : item.severity === 'warning' ? 'This week' : 'Monitor',
      actionLabel: item.actionLabel,
      actionHref: item.actionHref,
      severity: item.severity,
    }));
    if (!overviewSearch.trim()) return baseRows.slice(0, 6);
    const needle = overviewSearch.trim().toLowerCase();
    return baseRows
      .filter((row) => `${row.stage} ${row.issue} ${row.advertiser} ${row.owner}`.toLowerCase().includes(needle))
      .slice(0, 6);
  }, [attentionItems, overviewSearch, selectedWorkspaceName]);

  const liveCampaignCount = campaigns.filter((campaign) => campaign.status === 'active').length;
  const readyCreativeCount = creatives.filter((creative) => creative.latestVersion?.status === 'approved').length;
  const draftSetupCount = campaigns.filter((campaign) => campaign.status === 'draft').length;

  const issueCount = attentionItems.filter((item) => item.severity !== 'healthy').length;

  const handleWorkspaceChange = async (nextWorkspaceId: string) => {
    if (!nextWorkspaceId || nextWorkspaceId === activeWorkspaceId) return;
    try {
      await switchWorkspace(nextWorkspaceId);
      setActiveWorkspaceId(nextWorkspaceId);
      setCampaignId('');
    } catch (workspaceError: any) {
      setError(workspaceError.message ?? 'Failed to switch workspace.');
    }
  };

  return (
    <div className="min-h-full text-text-primary">
      <div className="dusk-page">
        <div className="dusk-toolbar">
          <div className="dusk-toolbar-group">
            <div className="relative min-w-[230px]">
              <select
                value={activeWorkspaceId}
                onChange={(event) => void handleWorkspaceChange(event.target.value)}
                className="dusk-select w-full appearance-none pr-10"
              >
                {workspaces.map((workspace) => (
                  <option key={workspace.id} value={workspace.id}>{workspace.name}</option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-text-soft" />
            </div>
            <select
              value={String(dateRange)}
              onChange={(event) => setDateRange(Number(event.target.value) as DateRange)}
              className="dusk-select"
            >
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <select
              value={campaignId}
              onChange={(event) => setCampaignId(event.target.value)}
              className="dusk-select"
            >
              <option value="">All campaigns</option>
              {campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </div>
          <div className="dusk-toolbar-group">
            <label className="relative block min-w-[320px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-text-soft">
                <SearchIcon className="h-5 w-5" />
              </span>
              <Input
                value={overviewSearch}
                onChange={(event) => setOverviewSearch(event.target.value)}
                className="min-h-[46px] w-full pl-10 pr-3"
                placeholder="Search campaign, advertiser, owner"
              />
            </label>
            <Button type="button" variant="secondary" onClick={() => void toggleTheme()}>
              <EyeIcon className="text-text-muted" />
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
            <NotificationButton count={issueCount} />
          </div>
        </div>

        <header className="dusk-page-header items-start">
          <div className="min-w-0 flex-1">
            <Kicker>Overview</Kicker>
            <h1 className="dusk-title mt-4">Launches, delivery and QA in one place</h1>
            <p className="dusk-copy">Use one daily command center to spot blockers, review tag activity, and move launch and delivery issues into action quickly.</p>
          </div>
          <Link
            to="/campaigns/new"
            className="inline-flex min-h-[46px] items-center rounded-xl bg-brand-gradient px-5 text-sm font-semibold text-white shadow-[0_16px_36px_rgba(241,0,139,0.28)] transition hover:-translate-y-[1px] hover:shadow-[0_18px_42px_rgba(241,0,139,0.34)]"
          >
            New trafficking task
          </Link>
        </header>

        {error ? <Panel className="mt-6 border-[color:var(--dusk-status-critical-border)] bg-[color:var(--dusk-status-critical-bg)] px-5 py-4 text-sm text-[color:var(--dusk-status-critical-fg)]">{error}</Panel> : null}

        {loading ? <div className="mt-8"><CenteredSpinner label="Loading overview…" /></div> : null}

        <div className="mt-8 grid gap-5 xl:grid-cols-4">
          {metricCards.map((metric) => (
            <MetricCard
              key={metric.id}
              label={metric.label}
              value={metric.value}
              delta={metric.delta}
              trend={metric.direction}
              context={metric.context}
              series={metric.series.length ? metric.series : [0, 0, 0, 0, 0]}
              tone={
                metric.icon === 'spend'
                  ? 'info'
                  : metric.icon === 'impressions'
                    ? 'brand'
                    : metric.icon === 'ctr'
                      ? 'success'
                      : metric.icon === 'engagements'
                        ? 'critical'
                        : 'neutral'
              }
              icon={<MetricIcon icon={metric.icon} />}
              className="p-1"
            />
          ))}
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
          <WorkQueueTable rows={workQueueRows} />
          <Panel className="p-6">
            <div className="space-y-8">
              <section>
              <Kicker>Today blockers</Kicker>
              <div className="mt-4 space-y-3">
                {attentionItems.slice(0, 3).map((item) => (
                  <Panel key={item.id} className="px-4 py-3">
                    <p className="font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-1 text-sm text-text-secondary">{item.detail}</p>
                  </Panel>
                ))}
              </div>
              </section>
              <section>
              <Kicker>Launch readiness</Kicker>
              <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <Panel className="px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Live campaigns</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{liveCampaignCount}</p>
                </Panel>
                <Panel className="px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Ready creatives</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{readyCreativeCount}</p>
                </Panel>
                <Panel className="px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-soft">Draft setup</p>
                  <p className="mt-2 text-2xl font-semibold text-text-primary">{draftSetupCount}</p>
                </Panel>
              </div>
              </section>
              <section>
              <Kicker>Quick ops</Kicker>
              <div className="mt-4 grid gap-3">
                <Link to="/campaigns" className="dusk-card-link p-4">
                  <p className="font-semibold text-text-primary">Campaign operations</p>
                  <p className="mt-1 text-sm text-text-secondary">Move from pacing and delivery issues into action.</p>
                </Link>
                <Link to="/tags" className="dusk-card-link p-4">
                  <p className="font-semibold text-text-primary">Tag firing health</p>
                  <p className="mt-1 text-sm text-text-secondary">Review implementation, cachebusters, and firing quality.</p>
                </Link>
                <Link to="/creatives" className="dusk-card-link p-4">
                  <p className="font-semibold text-text-primary">Creative QA</p>
                  <p className="mt-1 text-sm text-text-secondary">Handle approvals, previews, and assignment gaps.</p>
                </Link>
              </div>
              </section>
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}
