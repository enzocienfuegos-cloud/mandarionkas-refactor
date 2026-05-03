export interface Campaign {
  id: string;
  name: string;
  workspaceId?: string | null;
  workspace_id?: string | null;
  metadata?: { dsp?: string | null; mediaType?: string | null } | null;
}

export type TagFormat = 'VAST' | 'display' | 'native' | 'tracker';
export type TagStatus = 'draft' | 'active' | 'paused' | 'archived';
export type TrackerType = 'click' | 'impression';

export interface TagForm {
  name: string;
  campaignId: string;
  format: TagFormat;
  status: TagStatus;
  clickUrl: string;
  servingWidth: string;
  servingHeight: string;
  trackerType: TrackerType;
}

export interface SavedTag {
  id: string;
  format: TagFormat;
  name: string;
  workspaceId?: string | null;
  campaign?: { id: string; name: string; metadata?: { dsp?: string | null; mediaType?: string | null } | null } | null;
  width?: number | null;
  height?: number | null;
  sizeLabel?: string;
  trackerType?: TrackerType | null;
}

export interface DeliveryDiagnosticEntry {
  policy?: {
    includeDspHint?: boolean;
    includeClickMacro?: boolean;
    measurementPath?: string;
  } | null;
  selectedProfile?: string | null;
  url?: string;
  jsUrl?: string;
  htmlUrl?: string;
  staticProfiles?: {
    default?: string;
    basis?: string;
    illumin?: string;
  } | null;
  liveProfiles?: {
    default?: string;
    basis?: string;
    illumin?: string;
    vast4?: string;
  } | null;
  staticProfileStatus?: Record<string, {
    publicUrl?: string | null;
    storageKey?: string | null;
    available?: boolean;
    lastPublishedAt?: string | null;
    contentLength?: number | null;
    contentType?: string | null;
    etag?: string | null;
  }> | null;
  staticManifest?: {
    publicUrl?: string | null;
    generatedAt?: string | null;
    trigger?: string | null;
    previousGeneratedAt?: string | null;
    previousTrigger?: string | null;
    profileCount?: number | null;
    history?: Array<{
      generatedAt?: string | null;
      trigger?: string | null;
      profileCount?: number | null;
      profiles?: Array<{
        profile?: string | null;
        dsp?: string | null;
        xmlVersion?: string | null;
      }> | null;
    }> | null;
  } | null;
  staticJob?: {
    id?: string | null;
    status?: string | null;
    priority?: number | null;
    attempts?: number | null;
    maxAttempts?: number | null;
    trigger?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
    runAt?: string | null;
    startedAt?: string | null;
    completedAt?: string | null;
    failedAt?: string | null;
    error?: string | null;
  } | null;
}

export interface DeliveryDiagnosticsPayload {
  dsp?: {
    selected?: string | null;
  } | null;
  deliverySummary?: {
    basisNativeActive?: boolean;
    deliveryMode?: string | null;
    clickChain?: string | null;
    previewStatus?: string | null;
    previewNotes?: string | null;
  } | null;
  deliveryDiagnostics?: {
    displayWrapper?: DeliveryDiagnosticEntry;
    vast?: DeliveryDiagnosticEntry;
    trackerClick?: DeliveryDiagnosticEntry;
    trackerImpression?: DeliveryDiagnosticEntry;
  } | null;
}

export const emptyForm: TagForm = {
  name: '',
  campaignId: '',
  format: 'VAST',
  status: 'draft',
  clickUrl: '',
  servingWidth: '',
  servingHeight: '',
  trackerType: 'click',
};

export function normalizeTagRecord(payload: unknown): SavedTag | null {
  const source = (payload as { tag?: Record<string, unknown> } | null)?.tag
    ?? (payload as Record<string, unknown> | null);
  if (!source || typeof source !== 'object') return null;

  const format = source.format === 'display' || source.format === 'native' || source.format === 'VAST' || source.format === 'tracker'
    ? source.format
    : 'display';
  const creatives = Array.isArray(source.creatives) ? source.creatives : [];
  const firstCreative = creatives[0] as Record<string, unknown> | undefined;

  return {
    id: String(source.id ?? ''),
    format,
    name: String(source.name ?? ''),
    workspaceId: source.workspaceId != null ? String(source.workspaceId) : null,
    campaign: source.campaign && typeof source.campaign === 'object'
      ? {
          id: String((source.campaign as Record<string, unknown>).id ?? ''),
          name: String((source.campaign as Record<string, unknown>).name ?? ''),
          metadata: ((source.campaign as Record<string, unknown>).metadata as { dsp?: string | null; mediaType?: string | null } | null | undefined) ?? null,
        }
      : null,
    width: Number(source.servingWidth ?? firstCreative?.width ?? 0) || null,
    height: Number(source.servingHeight ?? firstCreative?.height ?? 0) || null,
    sizeLabel: String(source.sizeLabel ?? ''),
    trackerType: (source.trackerType === 'click' || source.trackerType === 'impression') ? source.trackerType : null,
  };
}

export function isBasisNativeEnabled(tag: SavedTag | null, useBasisNative: boolean): boolean {
  if (!tag) return false;
  if (!useBasisNative) return false;
  return tag.format === 'display' || tag.format === 'tracker';
}
