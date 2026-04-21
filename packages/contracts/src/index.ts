/**
 * @smx/contracts — Shared TypeScript types for SMX Studio
 */

// ── Auth ─────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface AuthSession {
  userId:      string;
  workspaceId: string;
  role:        UserRole;
  email:       string;
}

export interface User {
  id:         string;
  email:      string;
  firstName:  string;
  lastName:   string;
  role:       UserRole;
  createdAt:  string;
}

// ── Workspace ────────────────────────────────────────────────────────────

export interface Workspace {
  id:        string;
  name:      string;
  slug:      string;
  createdAt: string;
}

// ── Campaigns ────────────────────────────────────────────────────────────

export type CampaignStatus = 'draft' | 'active' | 'paused' | 'completed' | 'archived';

export interface Campaign {
  id:              string;
  workspaceId:     string;
  name:            string;
  advertiser:      string;
  status:          CampaignStatus;
  startDate:       string; // YYYY-MM-DD
  endDate:         string; // YYYY-MM-DD
  budget:          number;
  dailyBudget:     number | null;
  impressionGoal:  number | null;
  currency:        string;
  createdAt:       string;
  updatedAt:       string;
}

// ── Ad Tags ───────────────────────────────────────────────────────────────

export type TagFormat  = 'vast' | 'vpaid' | 'display' | 'native';
export type TagStatus  = 'draft' | 'active' | 'paused' | 'archived';

export interface AdTag {
  id:          string;
  workspaceId: string;
  campaignId:  string;
  name:        string;
  format:      TagFormat;
  status:      TagStatus;
  vastUrl:     string | null;
  embedCode:   string | null;
  createdAt:   string;
  updatedAt:   string;
}

// ── Creatives ─────────────────────────────────────────────────────────────

export type CreativeType   = 'video' | 'display' | 'native';
export type CreativeStatus = 'pending' | 'processing' | 'active' | 'rejected' | 'archived';

export interface Creative {
  id:          string;
  workspaceId: string;
  name:        string;
  type:        CreativeType;
  status:      CreativeStatus;
  assetUrl:    string | null;
  hlsUrl:      string | null;
  mimeType:    string | null;
  fileSize:    number | null;
  duration:    number | null;
  width:       number | null;
  height:      number | null;
  createdAt:   string;
  updatedAt:   string;
}

// ── Tracking ──────────────────────────────────────────────────────────────

export type TrackingEventType =
  | 'impression'
  | 'start'
  | 'firstQuartile'
  | 'midpoint'
  | 'thirdQuartile'
  | 'complete'
  | 'click'
  | 'skip'
  | 'mute'
  | 'unmute'
  | 'pause'
  | 'resume';

export interface TrackingEvent {
  id:          string;
  tagId:       string;
  event:       TrackingEventType;
  ip:          string;
  userAgent:   string;
  country:     string | null;
  region:      string | null;
  createdAt:   string;
}

// ── Reporting ─────────────────────────────────────────────────────────────

export interface DailyStat {
  date:        string;
  tagId:       string;
  impressions: number;
  clicks:      number;
  ctr:         number;
}

export interface TagSummary {
  tagId:       string;
  tagName:     string;
  impressions: number;
  clicks:      number;
  ctr:         number;
  completions: number;
  vcr:         number; // video completion rate
}

// ── Pacing ───────────────────────────────────────────────────────────────

export type PacingStatus = 'on_track' | 'ahead' | 'behind' | 'at_risk' | 'completed' | 'not_started';

export interface PacingRow {
  campaignId:       string;
  campaignName:     string;
  status:           PacingStatus;
  impressionGoal:   number;
  delivered:        number;
  expectedByNow:    number;
  pacingPct:        number;
  daysRemaining:    number;
  dailyBudget:      number | null;
}

// ── API Keys ──────────────────────────────────────────────────────────────

export interface ApiKey {
  id:          string;
  workspaceId: string;
  name:        string;
  prefix:      string;
  createdAt:   string;
  lastUsedAt:  string | null;
  revokedAt:   string | null;
}

// ── Webhooks ──────────────────────────────────────────────────────────────

export interface Webhook {
  id:          string;
  workspaceId: string;
  url:         string;
  events:      string[];
  active:      boolean;
  createdAt:   string;
}

// ── A/B Experiments ───────────────────────────────────────────────────────

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export interface AbExperiment {
  id:          string;
  workspaceId: string;
  name:        string;
  status:      ExperimentStatus;
  tagIds:      string[];
  trafficSplit: Record<string, number>; // tagId → pct
  createdAt:   string;
  updatedAt:   string;
}

// ── VAST tag generation request ───────────────────────────────────────────

export interface VastTagRequest {
  tagId:         string;
  adTitle:       string;
  mediaUrl:      string;
  clickUrl:      string;
  impressionUrl: string;
  duration?:     number;
  width?:        number;
  height?:       number;
}

// ── Pagination ────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data:  T[];
  total: number;
  page:  number;
  limit: number;
}

// ── Generic API response ──────────────────────────────────────────────────

export interface ApiError {
  error:   string;
  message: string;
  code?:   string;
}
