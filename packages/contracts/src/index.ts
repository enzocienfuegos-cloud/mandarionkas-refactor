/**
 * @smx/contracts — Shared TypeScript types for SMX Studio
 *
 * Exports two sets of types:
 *  1. Ad server / trafficking types (Campaign, AdTag, Creative, Pacing…)
 *  2. Creative Studio types (ActionTrigger, VideoWidgetData, OverlayConfig,
 *     SessionResponseDto, ProjectSummaryDto…) — required by apps/studio
 */

// ═══════════════════════════════════════════════════════════════════════════
// SECTION A — Creative Studio platform types
// ═══════════════════════════════════════════════════════════════════════════

// ── Platform roles & permissions ─────────────────────────────────────────
export type WorkspaceRole       = 'owner' | 'editor' | 'reviewer';
export type SessionPersistenceMode = 'local' | 'session';

export type PlatformPermission =
  | 'clients:create'
  | 'clients:update'
  | 'clients:invite'
  | 'clients:manage-members'
  | 'projects:create'
  | 'projects:view-client'
  | 'projects:save'
  | 'projects:delete'
  | 'projects:share-client'
  | 'assets:create'
  | 'assets:view-client'
  | 'assets:update'
  | 'assets:delete'
  | 'assets:manage-client'
  | 'brandkits:manage'
  | 'release:manage';

// ── Access scopes ─────────────────────────────────────────────────────────
export type ProjectAccessScope = 'private' | 'client' | 'reviewers';
export type AssetAccessScope   = 'private' | 'client';

// ── Auth DTOs (used by apps/studio auth-service) ─────────────────────────
export type AuthUserDto = {
  id:        string;
  name:      string;
  email:     string;
  role?:     WorkspaceRole;
  avatarUrl?: string | null;
};

export type AuthWorkspaceMemberDto = {
  userId:  string;
  role:    WorkspaceRole;
  addedAt: string;
};

export type AuthBrandDto = {
  id:             string;
  name:           string;
  primaryColor?:  string;
  secondaryColor?: string;
  accentColor?:   string;
  logoUrl?:       string;
  fontFamily?:    string;
};

export type AuthClientInviteDto = {
  id:         string;
  email:      string;
  role:       WorkspaceRole;
  status:     'pending' | 'accepted';
  invitedAt:  string;
};

export type AuthWorkspaceDto = {
  id:              string;
  name:            string;
  slug:            string;
  plan?:           string;
  logoUrl?:        string | null;
  brandColor?:     string;
  ownerUserId?:    string;
  memberUserIds?:  string[];
  members?:        AuthWorkspaceMemberDto[];
  invites?:        AuthClientInviteDto[];
  brands?:         AuthBrandDto[];
};

export type LoginRequestDto = {
  email:     string;
  password:  string;
  remember?: boolean;
};

export type AuthSessionDto = {
  sessionId:       string;
  persistenceMode: SessionPersistenceMode;
  issuedAt:        string;
  expiresAt:       string | null;
};

export type AuthSessionPayloadDto = {
  ok:               true;
  authenticated:    true;
  session:          AuthSessionDto;
  user:             AuthUserDto;
  activeClientId?:  string;
  activeWorkspaceId?: string;
  permissions:      PlatformPermission[];
  clients:          AuthWorkspaceDto[];
  workspaces?:      AuthWorkspaceDto[];
};

export type AuthAnonymousSessionDto = {
  ok:            true;
  authenticated: false;
  session:       null;
  user:          null;
  permissions:   PlatformPermission[];
  clients:       AuthWorkspaceDto[];
  workspaces?:   AuthWorkspaceDto[];
};

export type SessionResponseDto = AuthSessionPayloadDto | AuthAnonymousSessionDto;

export type LoginErrorDto = { ok: false; message?: string; code?: string };
export type LoginResponseDto = AuthSessionPayloadDto | LoginErrorDto;
export type LogoutResponseDto = { ok: true };

export type UpdateActiveClientRequestDto  = { clientId: string };
export type UpdateActiveClientResponseDto = {
  ok:               true;
  activeClientId:   string;
  activeWorkspaceId?: string;
  clients:          AuthWorkspaceDto[];
  workspaces?:      AuthWorkspaceDto[];
};

export type CreateClientRequestDto  = { name: string };
export type CreateClientResponseDto = {
  ok:               true;
  client:           AuthWorkspaceDto;
  workspace?:       AuthWorkspaceDto;
  activeClientId:   string;
  activeWorkspaceId?: string;
  clients:          AuthWorkspaceDto[];
  workspaces?:      AuthWorkspaceDto[];
};

export type CreateBrandRequestDto  = { name: string; primaryColor: string };
export type CreateBrandResponseDto = {
  ok:         true;
  client:     AuthWorkspaceDto;
  workspace?: AuthWorkspaceDto;
  clients:    AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

export type InviteMemberRequestDto  = { email: string; role: WorkspaceRole };
export type InviteMemberResponseDto = {
  ok:         boolean;
  message?:   string;
  client?:    AuthWorkspaceDto;
  workspace?: AuthWorkspaceDto;
  clients?:   AuthWorkspaceDto[];
  workspaces?: AuthWorkspaceDto[];
};

// ── Project DTOs ──────────────────────────────────────────────────────────
export type ProjectSummaryDto = {
  id:            string;
  name:          string;
  updatedAt:     string;
  clientId:      string;
  ownerUserId:   string;
  ownerName?:    string;
  brandId?:      string;
  brandName?:    string;
  campaignName?: string;
  accessScope?:  ProjectAccessScope;
  archivedAt?:   string;
  canvasPresetId?: string;
  sceneCount?:   number;
  widgetCount?:  number;
};

export type StudioStateSnapshotDto = Record<string, unknown>;

export type ListProjectsResponseDto        = { projects: ProjectSummaryDto[] };
export type DuplicateProjectResponseDto    = { project: ProjectSummaryDto };
export type ChangeProjectOwnerRequestDto   = { ownerUserId: string; ownerName?: string };

export type ProjectVersionSummaryDto = {
  id:            string;
  projectId:     string;
  projectName:   string;
  versionNumber: number;
  savedAt:       string;
  note?:         string;
};

export type SaveProjectRequestDto          = { state: StudioStateSnapshotDto; projectId?: string };
export type SaveProjectResponseDto         = { project: ProjectSummaryDto };
export type LoadProjectResponseDto         = { state: StudioStateSnapshotDto | null };
export type ListProjectVersionsResponseDto = { versions: ProjectVersionSummaryDto[] };
export type SaveProjectVersionRequestDto   = { state: StudioStateSnapshotDto; note?: string };
export type SaveProjectVersionResponseDto  = { version: ProjectVersionSummaryDto };
export type LoadProjectVersionResponseDto  = { state: StudioStateSnapshotDto | null };

// ── Asset DTOs ────────────────────────────────────────────────────────────

export type AssetKindDto              = 'image' | 'video' | 'font' | 'other';
export type AssetSourceTypeDto        = 'upload' | 'url';
export type AssetStorageModeDto       = 'object-storage' | 'remote-url';
export type AssetAccessScopeDto       = 'client' | 'private';
export type AssetQualityPreferenceDto = 'auto' | 'low' | 'mid' | 'high';
export type AssetProcessingStatusDto  = 'queued' | 'processing' | 'planned' | 'blocked' | 'completed' | 'failed' | 'skipped';

export { detectClickTagInHtml, detectDimensionsInHtml } from './html5-detector.mjs';

export type AssetDerivativeDto = {
  src:           string;
  mimeType?:     string;
  sizeBytes?:    number;
  width?:        number;
  height?:       number;
  bitrateKbps?:  number;
  codec?:        string;
};

export type AssetDerivativeSetDto = {
  original?:  AssetDerivativeDto;
  low?:       AssetDerivativeDto;
  mid?:       AssetDerivativeDto;
  high?:      AssetDerivativeDto;
  thumbnail?: AssetDerivativeDto;
  poster?:    AssetDerivativeDto;
};

export type AssetRecordDto = {
  id:                      string;
  name:                    string;
  kind?:                   string;
  src?:                    string;
  createdAt:               string;
  mimeType?:               string;
  sourceType?:             string;
  storageMode?:            string;
  storageKey?:             string;
  publicUrl?:              string;
  optimizedUrl?:           string;
  qualityPreference?:      string;
  processingStatus?:       string;
  processingMessage?:      string;
  processingAttempts?:     number;
  processingLastRetryAt?:  string;
  processingNextRetryAt?:  string;
  derivatives?:            AssetDerivativeSetDto;
  originUrl?:              string;
  fingerprint?:            string;
  sizeBytes?:              number;
  width?:                  number;
  height?:                 number;
  durationMs?:             number;
  posterSrc?:              string;
  thumbnailUrl?:           string;
  fontFamily?:             string;
  tags?:                   string[];
  folderId?:               string;
  clientId?:               string;
  ownerUserId?:            string;
  accessScope?:            string;
};

export type AssetFolderDto = {
  id:           string;
  name:         string;
  createdAt:    string;
  clientId?:    string;
  ownerUserId?: string;
  parentId?:    string;
};

export type PreparedAssetUploadDto = {
  assetId:       string;
  name?:         string;
  kind?:         string;
  mimeType?:     string;
  sizeBytes?:    number;
  width?:        number;
  height?:       number;
  durationMs?:   number;
  fingerprint?:  string;
  fontFamily?:   string;
  accessScope?:  string;
  tags?:         string[];
  folderId?:     string;
  storageKey?:   string;
  uploadUrl?:    string;
  publicUrl?:    string;
  optimizedUrl?: string;
  derivatives?:  AssetDerivativeSetDto;
};

// Asset upload DTOs
export type PrepareAssetUploadRequestDto  = Record<string, unknown>;
export type PrepareAssetUploadResponseDto = { upload?: PreparedAssetUploadDto };
export type CompleteAssetUploadRequestDto  = Record<string, unknown>;
export type CompleteAssetUploadResponseDto = { asset?: AssetRecordDto };

// Asset CRUD response DTOs
export type ListAssetsResponseDto           = { assets: AssetRecordDto[] };
export type GetAssetResponseDto             = { asset?: AssetRecordDto };
export type SaveAssetRequestDto             = { asset: Omit<AssetRecordDto, 'id' | 'createdAt' | 'clientId' | 'ownerUserId'> };
export type SaveAssetResponseDto            = { asset?: AssetRecordDto };
export type ListAssetFoldersResponseDto     = { folders: AssetFolderDto[] };
export type CreateAssetFolderResponseDto    = { folder?: AssetFolderDto };
export type RenameAssetRequestDto           = { name: string };
export type RenameAssetFolderRequestDto     = { name: string };
export type RenameAssetFolderResponseDto    = { folder?: AssetFolderDto };
export type MoveAssetRequestDto             = { folderId?: string };
export type UpdateAssetQualityRequestDto    = { qualityPreference: string };

// ── Action / interaction types ────────────────────────────────────────────
export type ActionTrigger =
  | 'click' | 'hover' | 'hover-enter' | 'hover-exit' | 'load'
  | 'timeline-enter' | 'timeline-exit'
  | 'video-play' | 'video-pause' | 'video-ended' | 'video-mute' | 'video-unmute'
  | 'vast-impression' | 'vast-quartile-25' | 'vast-quartile-50'
  | 'vast-quartile-75' | 'vast-complete' | 'vast-skip' | 'vast-click' | 'vast-error';

export type ActionEffectType =
  | 'open-url' | 'show-widget' | 'hide-widget' | 'toggle-widget'
  | 'set-text' | 'go-to-scene' | 'play-video' | 'pause-video'
  | 'seek-video' | 'mute-video' | 'unmute-video'
  | 'show-overlay' | 'hide-overlay'
  | 'fire-tracking-url' | 'emit-analytics-event';

export interface ActionNode {
  id:             string;
  widgetId:       string;
  trigger:        ActionTrigger;
  type:           ActionEffectType;
  label?:         string;
  disabled?:      boolean;
  targetWidgetId?: string;
  targetSceneId?: string;
  url?:           string;
  target?:        '_blank' | '_self';
  text?:          string;
  toSeconds?:     number;
  overlayId?:     string;
  urls?:          string[];
  eventName?:     string;
  metadata?:      Record<string, unknown>;
}

// ── Video widget & overlay types ──────────────────────────────────────────
export type PortableStyle = Record<string, string | number>;

export interface VASTConfig {
  tagUrl:                      string;
  maxRedirects?:               number;
  timeoutMs?:                  number;
  skipOffsetSecondsOverride?:  number;
  companionZoneId?:            string;
}

export type OverlayPosition = { left: number; top: number; width?: number; height?: number };

export interface CountdownContent  { fromSeconds: number; completedLabel?: string; style?: PortableStyle; }
export interface CTAContent        { label: string; url: string; openInNewTab?: boolean; style?: PortableStyle; }
export interface LogoContent       { assetId: string; altText?: string; style?: PortableStyle; }
export interface CustomHtmlContent { html: string; }

export type OverlayContentMap = {
  countdown:    CountdownContent;
  cta:          CTAContent;
  logo:         LogoContent;
  'custom-html': CustomHtmlContent;
};
export type OverlayKind = keyof OverlayContentMap;

export interface OverlayConfig<K extends OverlayKind = OverlayKind> {
  id:         string;
  kind:       K;
  triggerMs:  number;
  durationMs?: number;
  position:   OverlayPosition;
  content:    OverlayContentMap[K];
}

export interface VideoControlsConfig {
  showControls:   boolean;
  clickToToggle:  boolean;
  showMuteButton: boolean;
  autoPlay:       boolean;
  loop:           boolean;
  startMuted:     boolean;
}

export interface VideoWidgetTimeline { startMs: number; endMs?: number; }

export interface VideoWidgetData {
  kind:        'video';
  assetId?:    string;
  src?:        string;
  mimeType?:   string;
  vast?:       VASTConfig;
  overlays:    OverlayConfig[];
  controls:    VideoControlsConfig;
  timeline:    VideoWidgetTimeline;
  aspectRatio?: string;
  ariaLabel?:  string;
}

export function createDefaultVideoWidget(overrides?: Partial<VideoWidgetData>): VideoWidgetData {
  return {
    kind: 'video',
    overlays: [],
    controls: { showControls: true, clickToToggle: true, showMuteButton: true, autoPlay: false, loop: false, startMuted: true },
    timeline:  { startMs: 0 },
    aspectRatio: '16/9',
    ...overrides,
  };
}

// ── Overlay config schema (for inspector UI) ──────────────────────────────
export type SchemaFieldType = 'text' | 'url' | 'number' | 'color' | 'select' | 'toggle' | 'css-size' | 'asset-picker' | 'html-editor';

export interface SchemaField {
  key:          string;
  label:        string;
  inputType:    SchemaFieldType;
  required?:    boolean;
  defaultValue?: unknown;
  options?:     Array<{ value: string; label: string }>;
  hint?:        string;
  min?:         number;
  max?:         number;
}

export interface OverlayConfigSchema {
  kind:        string;
  label:       string;
  description: string;
  fields:      SchemaField[];
}

export const OVERLAY_SCHEMA_REGISTRY: Record<string, OverlayConfigSchema> = {
  countdown: {
    kind: 'countdown', label: 'Countdown Timer',
    description: 'Displays a countdown that ticks down from a configured duration.',
    fields: [
      { key: 'fromSeconds',     label: 'Count from (seconds)', inputType: 'number',   required: true, defaultValue: 10, min: 1, max: 3600 },
      { key: 'completedLabel',  label: 'Completed label',      inputType: 'text',     defaultValue: '' },
      { key: 'style.color',     label: 'Text color',           inputType: 'color',    defaultValue: '#ffffff' },
      { key: 'style.fontSize',  label: 'Font size',            inputType: 'css-size', defaultValue: '2rem' },
    ],
  },
  cta: {
    kind: 'cta', label: 'Call to Action',
    description: 'A clickable button that opens a URL.',
    fields: [
      { key: 'label',                  label: 'Button label',      inputType: 'text',   required: true, defaultValue: 'Learn More' },
      { key: 'url',                    label: 'Destination URL',   inputType: 'url',    required: true, defaultValue: '' },
      { key: 'openInNewTab',           label: 'Open in new tab',   inputType: 'toggle', defaultValue: true },
      { key: 'style.backgroundColor',  label: 'Button color',      inputType: 'color',  defaultValue: '#ffffff' },
      { key: 'style.color',            label: 'Text color',        inputType: 'color',  defaultValue: '#111111' },
      { key: 'style.borderRadius',     label: 'Border radius',     inputType: 'css-size', defaultValue: '4px' },
    ],
  },
  logo: {
    kind: 'logo', label: 'Logo / Image',
    description: 'Displays a static image or logo from your asset library.',
    fields: [
      { key: 'assetId',        label: 'Image asset', inputType: 'asset-picker', required: true },
      { key: 'altText',        label: 'Alt text',    inputType: 'text',         defaultValue: '' },
      { key: 'style.width',    label: 'Width',       inputType: 'css-size',     defaultValue: '120px' },
      { key: 'style.opacity',  label: 'Opacity',     inputType: 'number',       defaultValue: 1, min: 0, max: 1 },
    ],
  },
  'custom-html': {
    kind: 'custom-html', label: 'Custom HTML',
    description: 'Embed a custom HTML snippet. Rendered in a sandboxed iframe.',
    fields: [
      { key: 'html', label: 'HTML content', inputType: 'html-editor', required: true, defaultValue: '<p>Custom content</p>' },
    ],
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SECTION B — Ad server / trafficking types
// ═══════════════════════════════════════════════════════════════════════════

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
