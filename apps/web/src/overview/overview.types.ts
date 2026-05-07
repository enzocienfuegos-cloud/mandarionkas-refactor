export type DateRange = 7 | 30 | 90;
export type TrendDirection = 'up' | 'down' | 'flat';
export type AttentionSeverity = 'critical' | 'warning' | 'notice' | 'healthy';
export type WorkspaceStats = {
  total_impressions?: number;
  total_clicks?: number;
  total_spend?: number;
  total_engagements?: number;
  viewability_rate?: number;
  avg_ctr?: number;
  active_campaigns?: number;
  active_tags?: number;
  total_creatives?: number;
  total_hover_duration_ms?: number;
  measurable_rate?: number;
};

export type TimelinePoint = {
  date: string;
  impressions: number;
  clicks: number;
  ctr: number;
  viewability_rate: number;
  spend?: number;
};

export type BreakdownItem = {
  id?: string;
  name?: string;
  label?: string;
  status?: string;
  format?: string;
  source_kind?: string;
  impressions?: number;
  clicks?: number;
  ctr?: number;
  spend?: number;
  event_count?: number;
  event_type?: string;
};

export type Campaign = {
  id: string;
  workspace_id?: string;
  name: string;
  status: 'active' | 'paused' | 'archived' | 'draft';
};

export type Tag = {
  id: string;
  workspaceId?: string | null;
  name: string;
  format: 'VAST' | 'display' | 'native' | 'tracker';
  status: 'active' | 'paused' | 'archived' | 'draft';
  assignedCount?: number;
};

export type AuthPayload = {
  user?: { display_name?: string | null; email?: string | null };
  workspace?: { id?: string; name?: string };
};

export type AttentionItem = {
  id: string;
  title: string;
  detail: string;
  actionLabel: string;
  actionHref: string;
  severity: AttentionSeverity;
};

export type TopCampaignRow = {
  id: string;
  name: string;
  spend: string;
  ctr: string;
  status: 'Healthy' | 'Needs optimization' | 'Critical';
};

export type QuickNavRow = {
  id: string;
  label: string;
  detail: string;
  to: string;
  icon: 'campaigns' | 'creatives' | 'tags' | 'analytics';
  tone: string;
};

export type SystemHealthRow = {
  id: string;
  label: string;
  value: string;
  note: string;
  severity: AttentionSeverity | 'positive';
};

export type AudienceRow = {
  id: string;
  name: string;
  ctr: string;
  delta: string;
  direction: TrendDirection;
  score: number;
};

export type SegmentBreakdownItem = {
  label?: string;
  name?: string;
  clicks?: number;
  impressions?: number;
  ctr?: number;
  identity_count?: number;
};

export type WorkQueueRow = {
  id: string;
  stage: string;
  issue: string;
  advertiser: string;
  owner: string;
  due: string;
  actionLabel: string;
  actionHref: string;
  severity: AttentionSeverity;
};
