export type CreativeFormat = 'vast_video' | 'display' | 'native';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'draft' | 'pending_review';
export type SourceKind = 'legacy' | 'studio_export' | 'html5_zip' | 'video_mp4' | 'image_upload' | 'native_upload' | 'vast_wrapper';

export interface Creative {
  id: string;
  workspaceId?: string | null;
  workspaceName?: string | null;
  name: string;
  format: CreativeFormat;
  approvalStatus: ApprovalStatus;
  thumbnailUrl?: string;
  previewUrl?: string;
  createdAt: string;
  latestVersion?: CreativeVersion;
}

export interface CreativeVersion {
  id: string;
  creativeId: string;
  versionNumber: number;
  sourceKind: SourceKind;
  servingFormat: string;
  status: ApprovalStatus;
  publicUrl?: string;
  entryPath?: string;
  mimeType?: string;
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fileSize?: number | null;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
  creativeName?: string;
}

export interface CreativeArtifact {
  id: string;
  creativeVersionId: string;
  kind: string;
  storageKey?: string;
  publicUrl?: string;
  mimeType?: string;
  sizeBytes?: number | null;
  checksum?: string;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

export interface CreativeSizeVariant {
  id: string;
  creativeVersionId: string;
  label: string;
  width: number;
  height: number;
  status: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
  bindingCount?: number;
  activeBindingCount?: number;
  tagNames?: string[];
  totalImpressions?: number;
  totalClicks?: number;
  impressions7d?: number;
  clicks7d?: number;
  ctr?: number;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TagOption {
  id: string;
  name: string;
  format: 'VAST' | 'display' | 'native';
  status: 'active' | 'paused' | 'archived' | 'draft';
}

export interface TagBinding {
  id: string;
  tagId: string;
  creativeVersionId: string;
  creativeSizeVariantId?: string | null;
  status: 'draft' | 'active' | 'paused' | 'archived';
  weight: number;
  startAt?: string | null;
  endAt?: string | null;
  createdAt: string;
  updatedAt: string;
  creativeName: string;
  creativeVersionStatus: string;
  sourceKind: SourceKind | string;
  servingFormat: string;
  publicUrl?: string;
  entryPath?: string;
  variantLabel?: string;
  variantWidth?: number | null;
  variantHeight?: number | null;
  variantStatus?: string;
}

export interface CreativeIngestion {
  id: string;
  sourceKind: 'html5_zip' | 'video_mp4';
  status: 'uploaded' | 'processing' | 'validated' | 'failed' | 'published';
  originalFilename: string;
  mimeType?: string;
  sizeBytes?: number;
  publicUrl?: string;
  errorDetail?: string;
  creativeId?: string | null;
  creativeVersionId?: string | null;
  createdAt: string;
  updatedAt: string;
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const requestId = payload && typeof payload === 'object' ? payload.requestId ?? payload.request_id ?? null : null;
    const message = payload && typeof payload === 'object'
      ? payload.message ?? payload.error ?? null
      : null;
    const suffix = requestId ? ` (ref ${requestId})` : '';
    throw new Error(message ? `${message}${suffix}` : `Request failed (${response.status})${suffix}`);
  }
  return response.json() as Promise<T>;
}

function buildQuery(params: Record<string, string | null | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') query.set(key, value);
  });
  const text = query.toString();
  return text ? `?${text}` : '';
}

export async function loadCreatives(input: { scope?: 'all'; workspaceId?: string } = {}): Promise<Creative[]> {
  const payload = await fetchJson<{ creatives: Creative[] }>(`/v1/creatives${buildQuery({
    scope: input.scope,
    workspaceId: input.workspaceId,
    includeLatestVersion: '1',
  })}`);
  return payload.creatives ?? [];
}

export async function loadCreativeVersions(creativeId: string): Promise<CreativeVersion[]> {
  const payload = await fetchJson<{ versions: CreativeVersion[] }>(`/v1/creatives/${creativeId}/versions`);
  return payload.versions ?? [];
}

export async function loadCreativeVersionDetail(versionId: string): Promise<{
  creativeVersion: CreativeVersion;
  artifacts: CreativeArtifact[];
  variants: CreativeSizeVariant[];
}> {
  const payload = await fetchJson<{ creativeVersion: CreativeVersion; artifacts: CreativeArtifact[]; variants: CreativeSizeVariant[] }>(`/v1/creative-versions/${versionId}`);
  return {
    creativeVersion: payload.creativeVersion,
    artifacts: payload.artifacts ?? [],
    variants: payload.variants ?? [],
  };
}

export async function loadCreativeSizeVariants(versionId: string): Promise<CreativeSizeVariant[]> {
  const payload = await fetchJson<{ variants: CreativeSizeVariant[] }>(`/v1/creative-versions/${versionId}/variants`);
  return payload.variants ?? [];
}

export async function loadCreativesWithLatestVersion(input: { scope?: 'all'; workspaceId?: string } = {}) {
  const creatives = await loadCreatives(input);
  return {
    creatives,
    latestVersions: Object.fromEntries(
      creatives.map(creative => [creative.id, creative.latestVersion ?? null]),
    ),
  };
}

export async function loadCreativeIngestions(): Promise<CreativeIngestion[]> {
  const payload = await fetchJson<{ ingestions: CreativeIngestion[] }>('/v1/creative-ingestions');
  return payload.ingestions ?? [];
}

export async function loadTags(input: { scope?: 'all'; workspaceId?: string } = {}): Promise<TagOption[]> {
  const payload = await fetchJson<{ tags: TagOption[] }>(`/v1/tags${buildQuery({
    scope: input.scope,
    workspaceId: input.workspaceId,
  })}`);
  return payload.tags ?? [];
}

export async function createTag(input: {
  workspaceId?: string;
  name: string;
  format: 'VAST' | 'display' | 'native';
  status?: 'active' | 'paused' | 'archived' | 'draft';
  campaignId?: string | null;
}): Promise<TagOption | null> {
  const payload = await fetchJson<{ tag?: TagOption }>('/v1/tags', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      name: input.name,
      format: input.format,
      status: input.status ?? 'draft',
      campaignId: input.campaignId ?? null,
    }),
  });
  return payload.tag ?? null;
}

export async function loadTagBindings(tagId: string): Promise<TagBinding[]> {
  const payload = await fetchJson<{ bindings: TagBinding[] }>(`/v1/tags/${tagId}/bindings`);
  return payload.bindings ?? [];
}

export async function submitCreativeVersion(versionId: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/submit`, {
    method: 'POST',
  });
}

export async function loadPendingReviewVersions(): Promise<CreativeVersion[]> {
  const payload = await fetchJson<{ creativeVersions: CreativeVersion[] }>('/v1/creative-versions/pending-review');
  return payload.creativeVersions ?? [];
}

export async function approveCreativeVersion(versionId: string, notes?: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/approve`, {
    method: 'POST',
    body: JSON.stringify({ notes }),
  });
}

export async function rejectCreativeVersion(versionId: string, reason: string) {
  return fetchJson<{ creativeVersion: CreativeVersion }>(`/v1/creative-versions/${versionId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
}

export async function createCreativeIngestionUpload(input: {
  workspaceId?: string;
  sourceKind: 'html5_zip' | 'video_mp4';
  file: File;
  name?: string;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    upload: { ingestionId: string; storageKey: string; uploadUrl: string; publicUrl?: string };
  }>('/v1/creative-ingestions/upload-url', {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      sourceKind: input.sourceKind,
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      name: input.name,
    }),
  });
}

export async function uploadFileToSignedUrl(uploadUrl: string, file: File) {
  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: file.type ? { 'Content-Type': file.type } : undefined,
    body: file,
  });
  if (!response.ok) {
    throw new Error(`Upload failed (${response.status})`);
  }
}

export async function completeCreativeIngestion(ingestionId: string, input: {
  workspaceId?: string;
  file: File;
  publicUrl?: string;
  storageKey?: string;
  name?: string;
}) {
  return fetchJson<{ ingestion: CreativeIngestion }>(`/v1/creative-ingestions/${ingestionId}/complete`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      filename: input.file.name,
      mimeType: input.file.type || undefined,
      sizeBytes: input.file.size,
      publicUrl: input.publicUrl,
      storageKey: input.storageKey,
      name: input.name,
    }),
  });
}

export async function publishCreativeIngestion(ingestionId: string, input: {
  workspaceId?: string;
  name?: string;
}) {
  return fetchJson<{
    ingestion: CreativeIngestion;
    creative: Creative;
    creativeVersion: CreativeVersion;
  }>(`/v1/creative-ingestions/${ingestionId}/publish`, {
    method: 'POST',
    body: JSON.stringify({
      workspaceId: input.workspaceId ?? null,
      name: input.name,
    }),
  });
}

export async function assignCreativeVersionToTag(input: {
  creativeVersionId: string;
  tagId: string;
  weight?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ binding: { id: string } }>(`/v1/creative-versions/${input.creativeVersionId}/assign/${input.tagId}`, {
    method: 'POST',
    body: JSON.stringify({
      weight: input.weight ?? 1,
      status: input.status ?? 'active',
    }),
  });
}

export async function deleteCreativeById(creativeId: string) {
  const response = await fetch(`/v1/creatives/${creativeId}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const requestId = payload && typeof payload === 'object' ? payload.requestId ?? payload.request_id ?? null : null;
    const message = payload && typeof payload === 'object'
      ? payload.message ?? payload.error ?? null
      : null;
    const suffix = requestId ? ` (ref ${requestId})` : '';
    throw new Error(message ? `${message}${suffix}` : `Request failed (${response.status})${suffix}`);
  }
}

export async function createCreativeSizeVariant(input: {
  creativeVersionId: string;
  label?: string;
  width: number;
  height: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ variant: CreativeSizeVariant }>(`/v1/creative-versions/${input.creativeVersionId}/variants`, {
    method: 'POST',
    body: JSON.stringify({
      label: input.label,
      width: input.width,
      height: input.height,
      status: input.status,
      publicUrl: input.publicUrl,
      artifactId: input.artifactId,
      metadata: input.metadata,
    }),
  });
}

export async function createCreativeSizeVariantsBulk(input: {
  creativeVersionId: string;
  variants: Array<{
    label?: string;
    width: number;
    height: number;
    status?: 'draft' | 'active' | 'paused' | 'archived';
    publicUrl?: string;
    artifactId?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
}) {
  return fetchJson<{ created: CreativeSizeVariant[]; variants: CreativeSizeVariant[]; skippedCount: number }>(
    `/v1/creative-versions/${input.creativeVersionId}/variants/bulk`,
    {
      method: 'POST',
      body: JSON.stringify({
        variants: input.variants,
        status: input.status,
        publicUrl: input.publicUrl,
      }),
    },
  );
}

export async function updateCreativeSizeVariant(input: {
  variantId: string;
  label?: string;
  width?: number;
  height?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  publicUrl?: string;
  artifactId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  return fetchJson<{ variant: CreativeSizeVariant }>(`/v1/creative-variants/${input.variantId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      label: input.label,
      width: input.width,
      height: input.height,
      status: input.status,
      publicUrl: input.publicUrl,
      artifactId: input.artifactId,
      metadata: input.metadata,
    }),
  });
}

export async function updateCreativeSizeVariantsBulkStatus(input: {
  creativeVersionId: string;
  variantIds: string[];
  status: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ variants: CreativeSizeVariant[] }>(`/v1/creative-versions/${input.creativeVersionId}/variants/status`, {
    method: 'PATCH',
    body: JSON.stringify({
      variantIds: input.variantIds,
      status: input.status,
    }),
  });
}

export async function assignCreativeSizeVariantToTag(input: {
  creativeSizeVariantId: string;
  tagId: string;
  weight?: number;
  status?: 'draft' | 'active' | 'paused' | 'archived';
}) {
  return fetchJson<{ binding: { id: string } }>(`/v1/creative-variants/${input.creativeSizeVariantId}/assign/${input.tagId}`, {
    method: 'POST',
    body: JSON.stringify({
      weight: input.weight ?? 1,
      status: input.status ?? 'active',
    }),
  });
}

export async function updateTagBinding(input: {
  tagId: string;
  bindingId: string;
  status?: 'draft' | 'active' | 'paused' | 'archived';
  weight?: number;
}) {
  return fetchJson<{ binding: TagBinding }>(`/v1/tags/${input.tagId}/bindings/${input.bindingId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: input.status,
      weight: input.weight,
    }),
  });
}
